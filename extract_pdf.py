import sys
try:
    from pypdf import PdfReader
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    from pypdf import PdfReader

reader = PdfReader(r'c:\Users\Nipun\OneDrive\Desktop\Legal Platfrom - AG\Research\Pitch deck.pdf')
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open(r'c:\Users\Nipun\OneDrive\Desktop\Legal Platfrom - AG\Research\PitchDeck_Extracted.txt', 'w', encoding='utf-8') as f:
    f.write(text)
print("Extraction complete.")
