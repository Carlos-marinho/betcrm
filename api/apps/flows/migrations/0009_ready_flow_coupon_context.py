"""Passa bonus_code_key nos nós que agora exibem cupom.

Os templates resolvem {{ bonus_code }} a partir de extra_context.bonus_code_key.
Sem isso o bloco de cupom existe no email/SMS, mas renderiza vazio.
"""

from django.db import migrations


FLOW_NODE_COUPONS = {
    "welcome_ftd": {
        "email_d1": "welcome",
    },
    "deposit_failed": {
        "sms_immediate": "deposit_failed",
        "email_retry": "deposit_failed",
        "email_d1_retry": "deposit_failed",
    },
}


def _set_coupon(definition, node_id, coupon_key):
    changed = False
    for node in definition.get("nodes", []):
        if node.get("id") != node_id:
            continue
        config = node.setdefault("config", {})
        extra = config.setdefault("extra_context", {})
        if extra.get("bonus_code_key") != coupon_key:
            extra["bonus_code_key"] = coupon_key
            changed = True
    return changed


def _remove_coupon(definition, node_id):
    changed = False
    for node in definition.get("nodes", []):
        if node.get("id") != node_id:
            continue
        config = node.get("config", {})
        extra = config.get("extra_context", {})
        if "bonus_code_key" in extra:
            extra.pop("bonus_code_key", None)
            changed = True
        if config.get("extra_context") == {}:
            config.pop("extra_context", None)
    return changed


def apply_context(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")

    for flow_code, node_map in FLOW_NODE_COUPONS.items():
        flow = Flow.objects.filter(code=flow_code).first()
        if not flow or not isinstance(flow.definition, dict):
            continue
        changed = False
        for node_id, coupon_key in node_map.items():
            changed = _set_coupon(flow.definition, node_id, coupon_key) or changed
        if changed:
            flow.save(update_fields=["definition"])


def reverse_context(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")

    for flow_code, node_map in FLOW_NODE_COUPONS.items():
        flow = Flow.objects.filter(code=flow_code).first()
        if not flow or not isinstance(flow.definition, dict):
            continue
        changed = False
        for node_id in node_map:
            changed = _remove_coupon(flow.definition, node_id) or changed
        if changed:
            flow.save(update_fields=["definition"])


class Migration(migrations.Migration):
    dependencies = [
        ("flows", "0008_rename_flows_sched_flow_run_idx_flows_flows_flow_id_3f0ed0_idx"),
        ("templates", "0013_ready_flow_coupon_copy"),
    ]

    operations = [
        migrations.RunPython(apply_context, reverse_code=reverse_context),
    ]
