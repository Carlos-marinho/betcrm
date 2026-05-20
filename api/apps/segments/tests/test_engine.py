"""Testes do engine de segmentação."""

import pytest

from apps.profiles.models import Profile
from apps.segments.engine import SegmentEngine, SegmentEngineError


@pytest.fixture
def sample_profiles(db):
    Profile.objects.create(external_id="u1", email="a@a.com", ltv=100, deposit_count=1, tags=["FTD"])
    Profile.objects.create(external_id="u2", email="b@b.com", ltv=5000, deposit_count=10, tags=["FTD", "VIP_OURO"])
    Profile.objects.create(external_id="u3", email="c@c.com", ltv=0, deposit_count=0, tags=["NRC"])


def test_simple_gte(sample_profiles):
    rules = {"operator": "AND", "conditions": [{"field": "ltv", "operator": "gte", "value": 1000}]}
    qs = SegmentEngine.evaluate(rules)
    assert qs.count() == 1
    assert qs.first().external_id == "u2"


def test_contains_tag(sample_profiles):
    rules = {"operator": "AND", "conditions": [{"field": "tags", "operator": "contains", "value": "FTD"}]}
    qs = SegmentEngine.evaluate(rules)
    assert qs.count() == 2


def test_or_combination(sample_profiles):
    rules = {
        "operator": "OR",
        "conditions": [
            {"field": "ltv", "operator": "gte", "value": 5000},
            {"field": "tags", "operator": "contains", "value": "NRC"},
        ],
    }
    qs = SegmentEngine.evaluate(rules)
    assert qs.count() == 2


def test_nested_groups(sample_profiles):
    rules = {
        "operator": "AND",
        "conditions": [
            {"field": "deposit_count", "operator": "gte", "value": 1},
            {
                "operator": "OR",
                "conditions": [
                    {"field": "ltv", "operator": "gte", "value": 5000},
                    {"field": "tags", "operator": "contains", "value": "VIP_OURO"},
                ],
            },
        ],
    }
    qs = SegmentEngine.evaluate(rules)
    assert qs.count() == 1
    assert qs.first().external_id == "u2"


def test_disallowed_field_raises(sample_profiles):
    rules = {"operator": "AND", "conditions": [{"field": "password", "operator": "eq", "value": "x"}]}
    with pytest.raises(SegmentEngineError):
        SegmentEngine.evaluate(rules)
