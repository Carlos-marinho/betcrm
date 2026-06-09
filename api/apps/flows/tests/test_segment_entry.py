"""Testes para gatilhos de entrada em segmento."""

import pytest
from django.utils import timezone

from apps.flows.models import Flow, FlowExecution
from apps.flows.tasks import _try_enroll, evaluate_segment_entry_flows
from apps.profiles.models import Profile
from apps.segments.models import Segment


DEFAULT_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "trigger", "next": "exit"},
        {"id": "exit", "type": "exit"},
    ]
}


@pytest.fixture
def segment_profiles(db, workspace):
    matching = Profile.objects.create(
        workspace=workspace,
        external_id="vip_1",
        email="vip@example.com",
        ltv=1500,
    )
    Profile.objects.create(
        workspace=workspace,
        external_id="regular_1",
        email="regular@example.com",
        ltv=100,
    )
    return matching


@pytest.fixture
def flow_profile(db, workspace):
    return Profile.objects.create(
        workspace=workspace,
        external_id="flow_user_1",
        email="flow@example.com",
        ltv=100,
    )


def create_flow(workspace, **overrides):
    defaults = {
        "workspace": workspace,
        "name": "Reentry Flow",
        "code": "reentry_flow",
        "trigger_type": "event",
        "trigger_config": {"event_code": "user.register"},
        "is_active": True,
        "definition": DEFAULT_DEFINITION,
    }
    defaults.update(overrides)
    return Flow.objects.create(**defaults)


def test_segment_entry_flow_enrolls_matching_profiles(segment_profiles, workspace):
    Segment.objects.create(
        workspace=workspace,
        name="VIP",
        code="vip",
        rules={
            "operator": "AND",
            "conditions": [{"field": "ltv", "operator": "gte", "value": 1000}],
        },
    )
    flow = Flow.objects.create(
        workspace=workspace,
        name="VIP Flow",
        code="vip_flow",
        trigger_type="segment_entry",
        trigger_config={"segment_code": "vip"},
        is_active=True,
        definition=DEFAULT_DEFINITION,
    )

    evaluate_segment_entry_flows()

    execution = FlowExecution.objects.get(flow=flow)
    assert execution.profile == segment_profiles
    assert execution.trigger_event_id is None


def test_segment_entry_flow_does_not_duplicate_active_execution(segment_profiles, workspace):
    Segment.objects.create(
        workspace=workspace,
        name="VIP",
        code="vip",
        rules={
            "operator": "AND",
            "conditions": [{"field": "ltv", "operator": "gte", "value": 1000}],
        },
    )
    flow = Flow.objects.create(
        workspace=workspace,
        name="VIP Flow",
        code="vip_flow",
        trigger_type="segment_entry",
        trigger_config={"segment_code": "vip"},
        is_active=True,
        definition=DEFAULT_DEFINITION,
    )

    evaluate_segment_entry_flows()
    evaluate_segment_entry_flows()

    assert FlowExecution.objects.filter(flow=flow, profile=segment_profiles).count() == 1


def test_flow_without_reentry_blocks_after_finished_execution(flow_profile, workspace):
    flow = create_flow(workspace, allow_reentry=False)
    FlowExecution.objects.create(
        workspace=workspace,
        flow=flow,
        profile=flow_profile,
        current_node_id="exit",
        next_run_at=timezone.now(),
        state="completed",
        completed_at=timezone.now(),
    )

    _try_enroll(flow, flow_profile.id, event_id=None)

    assert FlowExecution.objects.filter(flow=flow, profile=flow_profile).count() == 1


def test_flow_with_reentry_blocks_during_cooldown(flow_profile, workspace):
    flow = create_flow(workspace, allow_reentry=True, reentry_cooldown_days=7)
    FlowExecution.objects.create(
        workspace=workspace,
        flow=flow,
        profile=flow_profile,
        current_node_id="exit",
        next_run_at=timezone.now(),
        state="completed",
        completed_at=timezone.now() - timezone.timedelta(days=2),
    )

    _try_enroll(flow, flow_profile.id, event_id=None)

    assert FlowExecution.objects.filter(flow=flow, profile=flow_profile).count() == 1


def test_flow_with_reentry_allows_after_cooldown(flow_profile, workspace):
    flow = create_flow(workspace, allow_reentry=True, reentry_cooldown_days=7)
    FlowExecution.objects.create(
        workspace=workspace,
        flow=flow,
        profile=flow_profile,
        current_node_id="exit",
        next_run_at=timezone.now(),
        state="completed",
        completed_at=timezone.now() - timezone.timedelta(days=8),
    )

    _try_enroll(flow, flow_profile.id, event_id=None)

    assert FlowExecution.objects.filter(flow=flow, profile=flow_profile).count() == 2
    assert FlowExecution.objects.filter(flow=flow, profile=flow_profile, state="active").exists()
