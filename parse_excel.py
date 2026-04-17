import pandas as pd
import json

try:
    file_path = r"c:\Users\neton\OneDrive\Projetos IA\Antigravit\dAIGAPEstim\Machine\Template - BRDC Complexity Definition ABAP (PT).xls"
    xls = pd.ExcelFile(file_path)
    
    print("Sheets available:", xls.sheet_names)
    
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        print(f"\n--- Sheet: {sheet_name} ---")
        # Print first 50 rows to get the structure
        print(df.head(50).to_string())
        
except Exception as e:
    print("Error:", e)
