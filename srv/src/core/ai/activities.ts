import { registerActivities, type AiActivity } from '@cnma/sap-aicore-integrate/react/shared';
import { EIGHTD_ACTIVITIES } from '../../../../shared/ai-activities';

export const APP_ACTIVITIES: readonly AiActivity[] = EIGHTD_ACTIVITIES;

let registered = false;

/** Idempotent — gọi nhiều lần vẫn chỉ đăng ký một lần. */
export function registerAppActivities(): void {
  if (registered) return;
  registerActivities([...APP_ACTIVITIES]);
  registered = true;
  console.log(
    `[ai/activities] Đã đăng ký ${APP_ACTIVITIES.length} activity: ${APP_ACTIVITIES.map((a) => a.key).join(', ')}`,
  );
}
