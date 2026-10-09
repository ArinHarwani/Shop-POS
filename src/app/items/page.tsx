'use client';

import React, { useState, useRef, useEffect } from 'react';
import { STRINGS, formatRupees } from '@/lib/strings';
import { Product } from '@/types';
import { DataService } from '@/lib/data-service';
import { Button } from '@/components/ui/Button';
import { TextField, NumberField } from '@/components/ui/TextField';

export default function ItemsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Add Item form fields
  const [itemNumber, setItemNumber] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Camera OCR State
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const itemNumberInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadProducts = async () => {
    try {
      const data = await DataService.getProducts();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => {
        itemNumberInputRef.current?.focus();
      }, 100);
    }
  }, [showAddForm]);

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.item_number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  // Save new item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!itemNumber.trim()) {
      setFormError('Item number is required.');
      return;
    }

    if (price === '' || price < 0) {
      setFormError('Price is required.');
      return;
    }

    if (!name.trim()) {
      setFormError('Item name is required.');
      return;
    }

    try {
      await DataService.addOrUpdateProduct({
        item_number: itemNumber.trim(),
        name: name.trim(),
        category: 'General',
        size: size || 'Free Size',
        color: color.trim() || 'Standard',
        price: Number(price),
        quantity_on_hand: quantity || 1,
      });

      await loadProducts();
      setFormSuccess(`Saved garment #${itemNumber.trim()}`);

      // Clear form & keep focus on Item number so staff can add next item
      setItemNumber('');
      setPrice('');
      setName('');
      setColor('');
      setQuantity(1);
      itemNumberInputRef.current?.focus();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
    }
  };

  // Import CSV text
  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split(/\r?\n/);
    let addedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.toLowerCase().startsWith('item') || line.toLowerCase().startsWith('#')) continue;
      // Format: item_number, name, price, quantity, size, color
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length >= 3) {
        const iNum = parts[0];
        const iName = parts[1];
        const iPrice = parseInt(parts[2], 10) || 0;
        const iQty = parseInt(parts[3], 10) || 1;
        const iSize = parts[4] || 'Free Size';
        const iColor = parts[5] || 'Standard';

        if (iNum && iName && iPrice >= 0) {
          await DataService.addOrUpdateProduct({
            item_number: iNum,
            name: iName,
            price: iPrice,
            quantity_on_hand: iQty,
            size: iSize,
            color: iColor,
          });
          addedCount++;
        }
      }
    }

    await loadProducts();
    setImportSummary(`Successfully imported ${addedCount} garments.`);
    setCsvText('');
    setTimeout(() => {
      setShowImport(false);
      setImportSummary(null);
    }, 1500);
  };

  // Camera scan assist (INV-5: dynamically import tesseract)
  const handleCameraScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanMessage('Scanning tag photo for barcode digits...');

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789' });

      const imageUrl = URL.createObjectURL(file);
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();

      const digits = data.text.match(/\d{4,12}/g) || [];
      const found = digits[0] || data.text.replace(/\D/g, '').trim();

      if (found) {
        setItemNumber(found);
        setScanMessage(`Scanned number: ${found}. Please confirm digits.`);
      } else {
        setScanMessage('No clear number detected. Please type manually.');
      }
    } catch {
      setScanMessage('Scan failed. Please type the number manually.');
    } finally {
      setIsScanning(false);
      itemNumberInputRef.current?.focus();
    }
  };

  return (
    <div className="w-full flex-1 flex justify-center bg-white">
      <div className="w-full max-w-[520px] flex flex-col min-h-[calc(100vh-64px)] px-4 py-4 sm:py-6">
        {/* ========================================================= */}
        {/* IMPORT SPREADSHEET VIEW                                   */}
        {/* ========================================================= */}
        {showImport ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">Import Garments</h1>
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  {STRINGS.backBtn}
                </button>
              </div>

              {importSummary && (
                <div className="p-3 bg-[#F6F6F4] text-[#15803D] rounded-[8px] border border-[#E6E6E6] text-[15px] font-medium">
                  {importSummary}
                </div>
              )}

              <p className="text-[15px] text-[#6B6B6B]">
                Paste comma-separated or tab-separated text from Excel / Google Sheets:
                <br />
                <span className="font-mono text-[13px] text-[#1A1A1A] block mt-1">
                  Item#, Name, Price, Quantity, Size, Color
                </span>
              </p>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="847291, Floral Satin Crop Top, 450, 10, M, Rose Pink&#10;847305, Velvet Bustier, 400, 5, S, Burgundy"
                rows={8}
                className="w-full p-3 border border-[#E6E6E6] rounded-[8px] font-mono text-[14px] focus:outline-none focus:border-[#1A1A1A]"
              />

              <Button variant="primary" fullWidth onClick={handleImportCsv} disabled={!csvText.trim()}>
                Import Garments
              </Button>
            </div>
          </div>
        ) : showAddForm ? (
          /* ========================================================= */
          /* ADD ITEM FORM VIEW                                        */
          /* ========================================================= */
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.addNewItemBtn}</h1>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-[15px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A]"
                >
                  {STRINGS.backBtn}
                </button>
              </div>

              {formSuccess && (
                <div className="p-3 bg-[#F6F6F4] text-[#15803D] rounded-[8px] border border-[#E6E6E6] text-[15px] font-medium">
                  {formSuccess}
                </div>
              )}

              {scanMessage && (
                <div className="p-3 bg-[#F6F6F4] text-[#B45309] rounded-[8px] border border-[#E6E6E6] text-[15px]">
                  {scanMessage}
                </div>
              )}

              <form onSubmit={handleSaveItem} className="flex flex-col gap-3">
                {/* Item Number + Scan camera button */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumberField
                      ref={itemNumberInputRef}
                      label={STRINGS.itemNumberLabel}
                      placeholder="e.g. 847291"
                      value={itemNumber}
                      onChange={(e) => setItemNumber(e.target.value)}
                      error={formError && !itemNumber ? formError : undefined}
                      required
                    />
                  </div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraScan}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isScanning}
                  >
                    {isScanning ? 'Reading...' : STRINGS.scanNumberCameraBtn}
                  </Button>
                </div>

                {/* Price */}
                <NumberField
                  label={STRINGS.priceLabel}
                  placeholder="e.g. 450"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  required
                />

                {/* Name */}
                <TextField
                  label={STRINGS.itemNameLabel}
                  placeholder="e.g. Floral Crop Top"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                {/* Size & Colour */}
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label={STRINGS.sizeLabel}
                    placeholder="M"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                  <TextField
                    label={STRINGS.colorLabel}
                    placeholder="Rose Pink"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>

                {/* Quantity */}
                <NumberField
                  label={STRINGS.quantityLabel}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                />

                {/* Link: Import from spreadsheet */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImport(true)}
                    className="text-[15px] text-[#6B6B6B] hover:text-[#1A1A1A] underline text-left"
                  >
                    {STRINGS.importSpreadsheetLink}
                  </button>
                </div>

                {/* Bottom Primary Button: Save */}
                <div className="pt-4">
                  <Button type="submit" variant="primary" fullWidth>
                    {STRINGS.saveItemBtn}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* ITEMS LIST VIEW                                           */
          /* ========================================================= */
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E6E6]">
                <h1 className="text-[20px] font-bold text-[#1A1A1A]">{STRINGS.navItems}</h1>
                <span className="text-[15px] text-[#6B6B6B]">{products.length} garments</span>
              </div>

              {/* Search Box on top */}
              {products.length > 0 && (
                <TextField
                  placeholder={STRINGS.searchItemsPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}

              {/* Result rows or Fresh Empty State */}
              <div className="flex flex-col">
                {products.length === 0 ? (
                  <div className="py-14 flex flex-col items-center justify-center text-center px-4 bg-[#F6F6F4] rounded-[8px] border border-[#E6E6E6] my-2">
                    <span className="text-[32px] mb-2">🏷️</span>
                    <div className="text-[18px] font-bold text-[#1A1A1A] mb-1">
                      No garments in inventory
                    </div>
                    <p className="text-[15px] text-[#6B6B6B] max-w-[320px] mb-5">
                      Your catalogue is fresh and ready. Add garments using the button below or import a batch from a spreadsheet.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full max-w-[280px]">
                      <Button
                        variant="primary"
                        fullWidth
                        onClick={() => {
                          setFormSuccess(null);
                          setShowAddForm(true);
                        }}
                      >
                        {STRINGS.addNewItemBtn}
                      </Button>
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={() => setShowImport(true)}
                      >
                        Import Batch
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-[#E6E6E6] border-t border-[#E6E6E6]">
                    {filteredProducts.map((p) => {
                      const isOut = p.quantity_on_hand === 0;
                      const isLow = p.quantity_on_hand > 0 && p.quantity_on_hand <= 2;

                      return (
                        <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[#1A1A1A] text-[17px]">{p.name}</div>
                            <div className="text-[15px] text-[#6B6B6B]">
                              #{p.item_number} • Size {p.size}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-[#1A1A1A] text-[17px]">
                              {formatRupees(p.price)}
                            </div>
                            <div
                              className={`text-[15px] font-medium ${
                                isOut
                                  ? 'text-[#B91C1C]'
                                  : isLow
                                  ? 'text-[#B45309]'
                                  : 'text-[#6B6B6B]'
                              }`}
                            >
                              {isOut
                                ? STRINGS.outOfStockLabel
                                : isLow
                                ? STRINGS.lowStockLabel.replace('{count}', String(p.quantity_on_hand))
                                : STRINGS.inStockLabel.replace('{count}', String(p.quantity_on_hand))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div className="py-12 text-center text-[#6B6B6B] text-[17px]">
                        No garments match "{search}".
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Main Action Button: Add Item */}
            {products.length > 0 && (
              <div className="sticky bottom-0 bg-white border-t border-[#E6E6E6] pt-3 pb-4">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setFormSuccess(null);
                    setShowAddForm(true);
                  }}
                >
                  {STRINGS.addNewItemBtn}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
