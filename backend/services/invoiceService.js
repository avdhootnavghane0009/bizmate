export class InvoiceService {
  /**
   * Calculate 18% GST (CGST + SGST split)
   */
  static calculateGST(subtotal, taxRate = 18.0) {
    const numSubtotal = Number(subtotal);
    const taxAmount = (numSubtotal * taxRate) / 100;
    const halfTax = Math.round((taxAmount / 2) * 100) / 100;
    const totalAmount = Math.round((numSubtotal + halfTax * 2) * 100) / 100;

    return {
      subtotal: numSubtotal,
      cgst: halfTax,
      sgst: halfTax,
      igst: 0.0,
      total_amount: totalAmount,
    };
  }
}
