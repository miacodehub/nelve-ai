import requests
import re
import csv

CITIES = ["Bangalore", "Mysore", "Jaipur", "Hampi", "Varanasi",
          "Udaipur", "Kochi", "Hyderabad", "Madurai", "Pune"]

HEADERS = {"User-Agent": "NomadAppResearch/1.0 (contact: your-email@example.com)"}

def get_wikitext(city):
    url = "https://en.wikivoyage.org/w/api.php"
    params = {
        "action": "parse", "page": city,
        "prop": "wikitext", "format": "json",
    }
    res = requests.get(url, params=params, headers=HEADERS, timeout=10)
    data = res.json()
    if "parse" not in data:
        return None
    return data["parse"]["wikitext"]["*"]

def extract_see_section(wikitext):
    match = re.search(r"==\s*See\s*==(.*?)(==[^=]|$)", wikitext, re.DOTALL)
    return match.group(1) if match else ""

def extract_listings(text):
    listings = []
    for block in re.findall(r"\{\{see(.*?)\}\}", text, re.DOTALL | re.IGNORECASE):
        name = re.search(r"\|\s*name\s*=\s*([^\|\n]+)", block)
        content = re.search(r"\|\s*content\s*=\s*([^\|\n]+)", block)
        lat = re.search(r"\|\s*lat\s*=\s*([^\|\n]+)", block)
        long_ = re.search(r"\|\s*long\s*=\s*([^\|\n]+)", block)
        if name and content:
            listings.append({
                "name": name.group(1).strip(),
                "description": content.group(1).strip()[:300],
                "lat": lat.group(1).strip() if lat else "",
                "lng": long_.group(1).strip() if long_ else "",
            })
    return listings

rows = []
for city in CITIES:
    print(f"{city}...")
    wikitext = get_wikitext(city)
    if not wikitext:
        print("  page not found")
        continue
    see_section = extract_see_section(wikitext)
    listings = extract_listings(see_section)
    print(f"  found {len(listings)} sights")
    for l in listings:
        l["city"] = city
        rows.append(l)

with open("places.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "description", "lat", "lng", "city"])
    writer.writeheader()
    writer.writerows(rows)

print(f"\ndone — {len(rows)} places")