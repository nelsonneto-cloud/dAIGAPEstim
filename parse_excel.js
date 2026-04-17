const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('Machine/Template - BRDC Complexity Definition ABAP (PT).xls');
    console.log("Sheets:", workbook.SheetNames);
    
    // Ler a primeira aba
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 0; i < Math.min(data.length, 100); i++) {
        console.log(`Row ${i}:`, data[i]);
    }
} catch (e) {
    console.error("Error:", e);
}
