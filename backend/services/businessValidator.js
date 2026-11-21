import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class BusinessValidator {
  /**
   * Validate appointments / reservations against active bookings
   */
  static async validateAndCheckAvailability(businessId, intentData) {
    const intent = intentData.intent;
    if (['appointment_booking', 'table_reservation'].includes(intent)) {
      try {
        const res = await query(
          "SELECT id FROM appointments WHERE business_id = $1 AND status = 'confirmed'",
          [businessId]
        );
        const count = res.rows.length;
        return {
          available: count < 5,
          slot: `${intentData.requested_date || 'tomorrow'} at ${intentData.requested_time || '18:00'}`,
          requires_human_handover: Boolean(intentData.requires_human_handover),
        };
      } catch (err) {
        logger.warn('Availability check fallback:', err.message);
        return {
          available: true,
          slot: `${intentData.requested_date || 'tomorrow'} at ${intentData.requested_time || '18:00'}`,
          requires_human_handover: Boolean(intentData.requires_human_handover),
        };
      }
    }

    return {
      available: true,
      requires_human_handover: Boolean(intentData.requires_human_handover),
    };
  }
}
