import React, { useEffect, useState } from 'react';
import { useBusiness } from '../../context/BusinessContext';
import { FileText, Download, Boxes, CheckCircle2, Plus, ShoppingCart, IndianRupee } from 'lucide-react';
import { api } from '../../api/client';

export const OperationsPage: React.FC = () => {
  const { business, industry } = useBusiness();
  const { terminology } = industry;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New product form
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodUnit, setProdUnit] = useState(terminology.unit || 'unit');

  // New order / transaction form
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [orderAmount, setOrderAmount] = useState('1500');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    if (!business.id) return;
    setLoading(true);
    Promise.all([
      api.get<any[]>('/operations/invoices').catch(() => []),
      api.get<any[]>('/operations/products').catch(() => [])
    ])
      .then(([invRes, prodRes]) => {
        setInvoices(Array.isArray(invRes) ? invRes : []);
        setProducts(Array.isArray(prodRes) ? prodRes : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [business.id]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post<any>('/operations/products', {
        name: prodName.trim(),
        price: parseFloat(prodPrice) || 0,
        stock_quantity: parseFloat(prodStock) || 0,
        unit: prodUnit || 'unit',
      });
      if (res && res.id) {
        setProducts(prev => [res, ...prev]);
      }
      setShowProductModal(false);
      setProdName('');
      setProdPrice('');
      setProdStock('');
    } catch (err) {
      console.error('Failed creating product:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(orderAmount) || 0;
    if (amount <= 0) return;

    setSubmitting(true);
    try {
      const res = await api.post<any>('/operations/orders/create', {
        customer_name: custName.trim() || 'Walk-in Customer',
        amount,
        status: 'completed',
      });
      if (res) {
        // Refresh invoices and dashboard data
        loadData();
      }
      setShowOrderModal(false);
      setCustName('');
      setOrderAmount('1500');
    } catch (err) {
      console.error('Failed recording order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181915] dark:text-[#EDE8DE]">
            Operations &amp; GST Invoicing
          </h1>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E] mt-0.5">
            Real inventory stock tracking, order fulfillment, and Indian GST Tax Invoices for {business.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProductModal(true)}
            className="px-3.5 py-2 bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:border-[#A0815A] transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#A0815A]" /> Add {terminology.catalogItem}
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="px-4 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Record {terminology.orderOrBooking}
          </button>
        </div>
      </div>

      {/* Modal: Add Product */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-6 rounded-2xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-sm">Add New {terminology.catalogItem}</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Item / Service Name *</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder={`e.g. ${industry.terminology.catalogItem} Name`}
                  required
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Unit</label>
                <input
                  type="text"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                  placeholder={terminology.unit}
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-3 py-1.5 border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#A0815A] text-white font-bold rounded-lg hover:bg-[#8C6F4B] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Order / Transaction */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] p-6 rounded-2xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-sm">Record Real {terminology.orderOrBooking}</h3>
            <p className="text-[11px] text-[#57554F] dark:text-[#9E998E]">
              Saves a transaction record to PostgreSQL and updates your dashboard revenue in real-time.
            </p>
            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">{terminology.customer} Name</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Transaction Total Amount (₹) *</label>
                <input
                  type="number"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  required
                  className="w-full bg-[#EDE8DE] dark:bg-[#181915] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg p-2 focus:outline-none focus:border-[#A0815A]"
                />
                <span className="text-[10px] text-[#57554F] dark:text-[#9E998E] mt-0.5 block">
                  Includes 9% CGST + 9% SGST automated tax calculation.
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-3 py-1.5 border border-[#D8CDBC] dark:border-[#2C2C26] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#A0815A] text-white font-bold rounded-lg hover:bg-[#8C6F4B] disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Tracking Cards */}
      <div>
        <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE] mb-3">
          {terminology.catalogItem} Catalog &amp; Inventory
        </h2>
        {products.length === 0 ? (
          <div className="p-6 border border-dashed border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl text-center text-xs text-[#57554F] dark:text-[#9E998E]">
            No catalog items found for this business. Click "Add {terminology.catalogItem}" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {products.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] space-y-1">
                <span className="text-[10px] font-mono text-[#A0815A] uppercase">{p.unit} unit</span>
                <p className="text-xs font-bold text-[#181915] dark:text-[#EDE8DE]">{p.name}</p>
                <div className="flex justify-between items-center pt-2 text-xs">
                  <span className="font-mono font-bold text-emerald-500">₹{p.price}</span>
                  <span className="text-[11px] text-[#57554F] dark:text-[#9E998E]">Stock: {p.stock_quantity}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GST Invoices Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[#181915] dark:text-[#EDE8DE]">
          Live Invoices &amp; Transaction Ledger
        </h2>
        {invoices.length === 0 ? (
          <div className="p-8 border border-dashed border-[#D8CDBC] dark:border-[#2C2C26] rounded-xl text-center text-xs text-[#57554F] dark:text-[#9E998E]">
            No invoices or orders recorded yet. Record a transaction to generate your first GST invoice.
          </div>
        ) : (
          <div className="bg-[#FFFFFF] dark:bg-[#20211D] border border-[#D8CDBC] dark:border-[#2C2C26] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EDE8DE] dark:bg-[#181915] border-b border-[#D8CDBC] dark:border-[#2C2C26] text-[#57554F] dark:text-[#9E998E]">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">{terminology.customer}</th>
                  <th className="p-3.5">Subtotal</th>
                  <th className="p-3.5">CGST (9%)</th>
                  <th className="p-3.5">SGST (9%)</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8CDBC] dark:divide-[#2C2C26]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#EDE8DE]/40 dark:hover:bg-[#181915]/40 transition">
                    <td className="p-3.5 font-mono font-bold text-[#A0815A]">{inv.id}</td>
                    <td className="p-3.5 font-semibold text-[#181915] dark:text-[#EDE8DE]">{inv.customer_name}</td>
                    <td className="p-3.5 font-mono">₹{inv.subtotal}</td>
                    <td className="p-3.5 font-mono text-[11px] text-[#57554F] dark:text-[#9E998E]">₹{inv.cgst}</td>
                    <td className="p-3.5 font-mono text-[11px] text-[#57554F] dark:text-[#9E998E]">₹{inv.sgst}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-500">₹{inv.total_amount}</td>
                    <td className="p-3.5">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                        inv.status === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
