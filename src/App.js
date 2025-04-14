import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { read, utils } from "xlsx";
import Barcode from "react-barcode";
import './App.css';

const BarcodeGenerator = () => {
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [manualSerial, setManualSerial] = useState("");
  const [manualBarcode, setManualBarcode] = useState(null);
  const barcodeRefs = useRef([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = utils.sheet_to_json(sheet, { header: 1 });

      const serials = json
        .filter((row) => row.length >= 5)
        .map((row) => ({
          barcode1: `${row[0]}${String(row[1]).padStart(3, '0')}-${row[2]}`,
          barcode2: `${row[3]}`,
          description: `${row[4] || ""}`,
        }));

      setSerialNumbers(serials);
      barcodeRefs.current = new Array(serials.length * 2);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleManualAdd = () => {
    if (manualSerial.trim() === "") return;
    setManualBarcode(manualSerial.trim());
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const rowHeight = 70;
    const itemsPerRow = 2;
    const marginLeft = 10;
    const marginTop = 10;

    const tasks = [];

    serialNumbers.forEach((item, index) => {
      const rowIndex = Math.floor(index / itemsPerRow);
      const colIndex = index % itemsPerRow;

      const x = marginLeft + colIndex * 100;
      const y = marginTop + rowIndex * rowHeight;

      const barcode1El = barcodeRefs.current[index * 2];
      const barcode2El = barcodeRefs.current[index * 2 + 1];

      tasks.push(
        (async () => {
          const imgData1 = await getImageData(barcode1El);
          const imgData2 = await getImageData(barcode2El);

          if (imgData1) doc.addImage(imgData1, "PNG", x, y, 90, 30);
          if (imgData2) doc.addImage(imgData2, "PNG", x, y + 35, 90, 30);

          const textX = x + 2;
          const textY = y + 70;
          if (item.description) {
            doc.setFontSize(10);
            doc.text(item.description, textX, textY, { maxWidth: 90 });
          }
        })()
      );
    });

    Promise.all(tasks).then(() => {
      doc.save("barcodes.pdf");
    });
  };

  const getImageData = (barcodeEl) => {
    return new Promise((resolve) => {
      if (!barcodeEl) return resolve(null);
      const svgString = new XMLSerializer().serializeToString(barcodeEl);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = "data:image/svg+xml;base64," + btoa(svgString);
    });
  };

  return (
    <div className="app-container">
      <h1>Barcode Generator</h1>
      <p> Bar Code Type: CODE39</p>

      {/* File upload */}
      <input
        type="file"
        id="file-upload"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
      />
      <label htmlFor="file-upload" className="file-upload-label">
        Choose File
      </label>

      {/* Manual serial input */}
      <div className="manual-entry">
        <input
          type="text"
          placeholder="Enter serial code manually "
          value={manualSerial}
          onChange={(e) => setManualSerial(e.target.value)}
        />
        <button onClick={handleManualAdd}>Generate Barcode</button>
      </div>

      {/* Show manual barcode if available */}
      {manualBarcode && (
        <div className="manual-barcode-preview">
          <Barcode
            value={manualBarcode}
            format="CODE39"
            displayValue={true}
            width={1.5}
            height={50}
          />
        </div>
      )}

      {/* Download button */}
      {serialNumbers.length > 0 && (
        <button onClick={generatePDF}>Download Barcodes as PDF</button>
      )}

      {/* Display barcodes from Excel */}
      <div className="barcode-grid">
        {serialNumbers.map((item, index) => (
          <div className="barcode-row" key={index}>
            <div className="barcode-box">
              <Barcode
                value={item.barcode1}
                format="CODE39"
                displayValue={true}
                width={1.5}
                height={50}
                ref={(el) => (barcodeRefs.current[index * 2] = el?.svg)}
              />
            </div>
            <div className="barcode-box">
              <Barcode
                value={item.barcode2}
                format="CODE39"
                displayValue={true}
                width={1.5}
                height={50}
                ref={(el) => (barcodeRefs.current[index * 2 + 1] = el?.svg)}
              />
              <div className="description">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BarcodeGenerator;
