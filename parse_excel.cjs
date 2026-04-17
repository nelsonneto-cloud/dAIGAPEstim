const XLSX = require('xlsx');
const fs = require('fs');

try {
    const workbook = XLSX.readFile('Machine/Template - BRDC Complexity Definition ABAP (PT).xls');
    let out = "";
    
    // Ler a aba 'Relatório'
    const sheet = workbook.Sheets['Relatório'];
    if (!sheet) {
        console.log("Sheet Relatório not found");
        process.exit(1);
    }
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 0; i < Math.min(data.length, 100); i++) {
        // filter out empty arrays
        if (data[i] && data[i].length > 0) {
            out += `Row ${i}: ${JSON.stringify(data[i])}\n`;
        }
    }
    fs.writeFileSync('excel_output_relatorio.txt', out, 'utf8');
} catch (e) {
    console.error("Error:", e);
}
