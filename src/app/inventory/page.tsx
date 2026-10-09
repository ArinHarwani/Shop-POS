'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  FileSpreadsheet,
  Camera,
  Search,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Product } from '@/types';
import { DataService } from '@/lib/data-service';
import { getActiveRole } from '@/lib/storage';
import { parseProductCsv, getProductCsvTemplate, downloadCsvFile, CsvImportRowResult } from '@/lib/csv';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [activeTab, setActiveTab] = useState<'list' | 'rapid-add' | 'csv-import' | 'ocr'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Rapid Add Form State (INV-3)
  const [itemNumber, setItemNumber] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tops');
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<Product | null>(null);

  // CSV Import State (INV-4)
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{ totalRows: number; validRows: Product[]; results: CsvImportRowResult[] } | null>(null);
  const [csvImportMessage, setCsvImportMessage] = useState<string | null>(null);

  // OCR State (INV-5: dynamically loaded only here)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Adjust Stock Modal State (INV-7)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Inventory recount');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const itemNumberInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    setRole(getActiveRole());
  }, []);

  const loadProducts = async () => {
    const list = await DataService.getProducts();
    setProducts(list);
  };

  // Check duplicate item number in real-time (INV-2)
  const handleItemNumberChange = (val: string) => {
    setItemNumber(val);
    setFormError(null);
    setFormSuccess(null);
    const clean = val.trim().toLowerCase();
    if (!clean) {
      setDuplicateMatch(null);
      return;
    }
    const match = products.find((p) => p.item_number.toLowerCase() === clean);
    setDuplicateMatch(match || null);
  };

  // Add or Update Rapid-Add Item (INV-1, INV-2, INV-3)
  const handleRapidAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!itemNumber.trim()) {
      setFormError('Item number is required.');
      return;
    }

    if (!name.trim()) {
      setFormError('Item name/description is required.');
      return;
    }

    if (price === '' || price < 0) {
      setFormError('Price must be a valid positive amount.');
      return;
    }

    try {
      await DataService.addOrUpdateProduct({
        item_number: itemNumber.trim(),
        name: name.trim(),
        category,
        size,
        color: color.trim() || 'Standard',
        price: Number(price),
        quantity_on_hand: quantity,
        is_active: true,
      });

      setFormSuccess(`Product #${itemNumber} successfully saved!`);
      await loadProducts();

      // Reset form & keep focus on Item Number field (INV-3)
      setItemNumber('');
      setName('');
      setColor('');
      setPrice('');
      setQuantity(1);
      setDuplicateMatch(null);
      itemNumberInputRef.current?.focus();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    }
  };

  // Handle Add Quantity for Duplicate
  const handleAddQuantityToExisting = async () => {
    if (!duplicateMatch) return;
    try {
      await DataService.addOrUpdateProduct({
        item_number: duplicateMatch.item_number,
        name: duplicateMatch.name,
        price: duplicateMatch.price,
        quantity_on_hand: duplicateMatch.quantity_on_hand + quantity,
      });
      setFormSuccess(`Added ${quantity} units to #${duplicateMatch.item_number}. New stock: ${duplicateMatch.quantity_on_hand + quantity}`);
      await loadProducts();
      setItemNumber('');
      setDuplicateMatch(null);
      itemNumberInputRef.current?.focus();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update stock');
    }
  };

  // CSV Import handlers (INV-4)
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const parsed = parseProductCsv(text);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleParseCsvText = (text: string) => {
    setCsvText(text);
    const parsed = parseProductCsv(text);
    setCsvPreview(parsed);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    try {
      const res = await DataService.bulkAddProducts(csvPreview.validRows);
      setCsvImportMessage(`Successfully imported ${res.added} new products and updated ${res.updated} existing items!`);
      await loadProducts();
      setCsvPreview(null);
      setCsvText('');
    } catch (err: any) {
      setCsvImportMessage(`Import error: ${err.message}`);
    }
  };

  // OCR Tag Barcode Number Assist (INV-5: dynamically loads Tesseract.js)
  const handleOcrImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrResult(null);
    setOcrWarning(null);

    const imageUrl = URL.createObjectURL(file);
    setSelectedImagePreview(imageUrl);

    try {
      // Dynamic import of Tesseract.js to avoid bloating main bundle
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');

      // Restrict OCR whitelist to digits only
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
      });

      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();

      const recognizedText = data.text.replace(/\s+/g, '').trim();
      const numbersFound = data.text.match(/\d{4,14}/g) || [];

      if (numbersFound.length === 0 && !recognizedText) {
        setOcrWarning('No barcode digits detected. Please enter item number manually.');
      } else if (numbersFound.length > 1) {
        setOcrResult(numbersFound[0] || null);
        setOcrWarning(`Multiple candidates found (${numbersFound.join(', ')}). Filled first candidate for your confirmation.`);
      } else {
        const found = numbersFound[0] || recognizedText || null;
        setOcrResult(found);
        if (data.confidence < 60) {
          setOcrWarning(`Low confidence scan (${Math.round(data.confidence)}%). Please verify the digits.`);
        }
      }
    } catch (err: any) {
      console.error('OCR processing error', err);
      setOcrWarning('OCR failed. You can type the number directly in the manual field.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleApplyOcrToItemNumber = () => {
    if (!ocrResult) return;
    setItemNumber(ocrResult);
    setActiveTab('rapid-add');
    setTimeout(() => {
      itemNumberInputRef.current?.focus();
    }, 100);
  };

  // Stock Adjustment (INV-7)
  const handleSaveStockAdjustment = async () => {
    if (!adjustingProduct) return;
    setAdjustError(null);
    try {
      await DataService.adjustStock(adjustingProduct.id, adjustDelta, adjustReason, adjustNote);
      await loadProducts();
      setAdjustingProduct(null);
      setAdjustDelta(0);
      setAdjustNote('');
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust stock');
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.item_number.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-rose-500" />
            <span>Stock & Inventory Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Rapid stock entry, CSV spreadsheet import, barcode OCR assist, and stock adjustments
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'list' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('rapid-add')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'rapid-add' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Rapid Add</span>
          </button>
          <button
            onClick={() => setActiveTab('csv-import')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'csv-import' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV Import</span>
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              activeTab === 'ocr' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Tag OCR</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PRODUCT LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by item number, description or category..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <button
              onClick={loadProducts}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Refresh catalogue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Product Table */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Item #</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Size & Color</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock on Hand</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-rose-300">
                        #{p.item_number}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-3 text-slate-300">{p.category}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {p.size} • {p.color}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-white">
                        Rs {p.price}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            p.quantity_on_hand > 0
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                              : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                          }`}
                        >
                          {p.quantity_on_hand}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setAdjustingProduct(p)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        No products match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RAPID ADD FORM (INV-3) */}
      {activeTab === 'rapid-add' && (
        <div className="max-w-2xl mx-auto w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-500" />
              <span>Rapid Product Add</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Focus resets to Item # after save for rapid tag entry
            </span>
          </div>

          {formSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Duplicate Item Notice (INV-2) */}
          {duplicateMatch && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Item #{duplicateMatch.item_number} already exists!</span>
              </div>
              <p className="text-slate-300">
                "{duplicateMatch.name}" is currently in inventory with {duplicateMatch.quantity_on_hand} units on hand @ Rs {duplicateMatch.price}.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddQuantityToExisting}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  Add +{quantity} to existing stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setName(duplicateMatch.name);
                    setPrice(duplicateMatch.price);
                    setCategory(duplicateMatch.category);
                    setSize(duplicateMatch.size);
                    setColor(duplicateMatch.color);
                    setDuplicateMatch(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                >
                  Edit details
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleRapidAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Item Number */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Item Number * (Keep leading zeros)
                </label>
                <input
                  ref={itemNumberInputRef}
                  type="text"
                  inputMode="numeric"
                  value={itemNumber}
                  onChange={(e) => handleItemNumberChange(e.target.value)}
                  placeholder="e.g. 847291 or 004812"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              {/* Name / Description */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Garment Name / Description *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Velvet Crop Top"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="Tops">Tops</option>
                  <option value="Dresses">Dresses</option>
                  <option value="Jeans">Jeans</option>
                  <option value="Skirts">Skirts</option>
                  <option value="Pants">Pants</option>
                  <option value="Outerwear">Outerwear</option>
                  <option value="Accessories">Accessories</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="Free Size">Free Size</option>
                  <option value="28">28</option>
                  <option value="30">30</option>
                  <option value="32">32</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Color</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Burgundy, Rose Pink"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Price (Whole Rs) *
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                  placeholder="e.g. 450"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Quantity on Hand (Default 1)
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  min="1"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/60 transition-all touch-target"
              >
                Save Product & Next (Enter)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CSV IMPORT (INV-4) */}
      {activeTab === 'csv-import' && (
        <div className="space-y-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-rose-500" />
                  <span>Bulk CSV & Spreadsheet Import</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Upload a CSV file or paste rows directly from Excel / Google Sheets
                </p>
              </div>
              <button
                onClick={() => downloadCsvFile('trendy_product_template.csv', getProductCsvTemplate())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {csvImportMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{csvImportMessage}</span>
              </div>
            )}

            {/* File Upload / Paste Area */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-rose-400" />
                  <span>Choose CSV File</span>
                </button>
                <span className="text-xs text-slate-500">or paste CSV text below:</span>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => handleParseCsvText(e.target.value)}
                placeholder="item_number,name,category,size,color,price,quantity&#10;847291,Floral Crop Top,Tops,M,Rose Pink,450,1"
                rows={5}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Preview Table with row errors */}
            {csvPreview && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Preview: {csvPreview.validRows.length} valid of {csvPreview.totalRows} rows
                  </span>
                  <button
                    onClick={handleExecuteCsvImport}
                    disabled={csvPreview.validRows.length === 0}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-rose-950/60 transition-all"
                  >
                    Confirm & Import {csvPreview.validRows.length} Items
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Item #</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Qty</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {csvPreview.results.map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={r.isValid ? 'bg-slate-900/40' : 'bg-rose-950/20 text-rose-300'}
                        >
                          <td className="px-3 py-2 font-mono">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-mono font-bold">
                            {r.data.item_number || '—'}
                          </td>
                          <td className="px-3 py-2">{r.data.name || '—'}</td>
                          <td className="px-3 py-2 font-mono">Rs {r.data.price}</td>
                          <td className="px-3 py-2 font-mono">{r.data.quantity_on_hand}</td>
                          <td className="px-3 py-2">
                            {r.isValid ? (
                              <span className="text-emerald-400 font-semibold">Valid</span>
                            ) : (
                              <span className="text-rose-400 font-medium">
                                {r.errors.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TAG OCR ASSIST (INV-5) */}
      {activeTab === 'ocr' && (
        <div className="max-w-xl mx-auto w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-rose-500" />
              <span>Barcode Tag OCR Assist</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reads printed barcode numbers from garment tag photos. All other fields are entered manually.
            </p>
          </div>

          {/* Photo upload / Capture */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-rose-500/60 transition-colors">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleOcrImageSelect}
                id="ocr-file-input"
                className="hidden"
              />
              <label
                htmlFor="ocr-file-input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <Camera className="w-10 h-10 text-rose-400" />
                <span className="text-sm font-bold text-white">
                  Take Tag Photo or Upload Image
                </span>
                <span className="text-xs text-slate-400">
                  Focus cleanly on the printed barcode number on the tag
                </span>
              </label>
            </div>

            {selectedImagePreview && (
              <div className="rounded-xl overflow-hidden max-h-48 flex justify-center bg-black/40 border border-slate-800">
                <img
                  src={selectedImagePreview}
                  alt="Tag preview"
                  className="object-contain max-h-48"
                />
              </div>
            )}

            {ocrLoading && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-rose-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300">
                  Analyzing barcode digits in browser (Tesseract OCR)...
                </p>
              </div>
            )}

            {ocrWarning && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>{ocrWarning}</span>
              </div>
            )}

            {ocrResult && (
              <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">
                    Detected Item Number:
                  </span>
                  <span className="font-mono font-black text-lg text-emerald-400">
                    #{ocrResult}
                  </span>
                </div>
                <button
                  onClick={handleApplyOcrToItemNumber}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
                >
                  Use #{ocrResult} in Rapid Add Form →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADJUST STOCK MODAL (INV-7: Owner only) */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111726] border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-rose-400" />
                  <span>Adjust Stock</span>
                </h3>
                <p className="text-xs text-slate-400">
                  #{adjustingProduct.item_number} • {adjustingProduct.name}
                </p>
              </div>
              {role !== 'owner' && <Lock className="w-4 h-4 text-amber-400" />}
            </div>

            {role !== 'owner' ? (
              <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                Only the Owner role is permitted to manually adjust stock levels. Switch your role to Owner in the top navigation bar to proceed.
              </div>
            ) : (
              <div className="space-y-3">
                {adjustError && (
                  <p className="text-xs text-rose-400 bg-rose-950/30 p-2 rounded">
                    {adjustError}
                  </p>
                )}

                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Current stock on hand:</span>
                  <span className="font-mono font-bold text-white">
                    {adjustingProduct.quantity_on_hand}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Delta (+ or - units)
                  </label>
                  <input
                    type="number"
                    value={adjustDelta || ''}
                    onChange={(e) => setAdjustDelta(parseInt(e.target.value, 10) || 0)}
                    placeholder="+5 or -2"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    New quantity will be: {adjustingProduct.quantity_on_hand + adjustDelta}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Reason *
                  </label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="Physical count discrepancy">Physical count discrepancy</option>
                    <option value="Damaged tag/garment">Damaged tag/garment</option>
                    <option value="Returned from display">Returned from display</option>
                    <option value="Stock transfer">Stock transfer</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="Audit note"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              {role === 'owner' && (
                <button
                  onClick={handleSaveStockAdjustment}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/60"
                >
                  Save Adjustment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
