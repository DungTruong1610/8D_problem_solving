---
skill: BTP Infrastructure Management
description: Administrating SAP BTP Subaccounts, Connectivity, and Security.
---

# ☁️ BTP Infrastructure Management Skill

**Context:** Use this skill for "Day 0" setup or "Day 2" operations that are not handled by the Code.

## 1. Resource Management (Terraform/CLI)
- **Subaccounts:** Logical isolation for `Dev`, `Test`, `Prod`.
- **Entitlements:** Quotas (e.g., "Assign 2 units of HANA Cloud to Dev").
- **Spaces:** Cloud Foundry isolation within a subaccount.

## 2. Connectivity & Destinations
- **Cloud Connector:**
    - Verify "Principal Propagation" is enabled.
    - Whitelist internal S/4HANA resources.
- **Destination Service:**
    - Create Destinations at the *Subaccount Level* for shared usage.
    - Check "Check Connection" button for validity.

## 3. Security & Trust (IAS)
- **Identity Provider:** Establish trust with SAP Cloud Identity Services (IAS).
- **Role Collections:** Assign Role Collections to User Groups, not individual Users.

## 4. Troubleshooting
- **Memory:** Use `cf app <name>` to check RAM usage. Scale up if OOM (Out of Memory).
- **Logs:** Use `cf logs <name> --recent` to see crash details.
