import csv
from bs4 import BeautifulSoup

def rip_target_birds(html_file, output_csv):
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        # Find all result items in the target list
        items = soup.find_all('li', class_='ResultsStats')
        
        bird_data = []
        
        for item in items:
            # 1. Extract Bird Name
            # Found inside the h5 within SpecimenHeader
            name_el = item.select_one('h5.SpecimenHeader-joined')
            if not name_el:
                continue
            bird_name = name_el.get_text(strip=True)

            # 2. Extract Frequency Percentage
            # Found in the stats-count span
            freq_el = item.select_one('.ResultsStats-stats .Heading--h4')
            frequency = freq_el.get_text(strip=True) if freq_el else "0%"

            # 3. "Clean" Filter: Skip hybrids, 'sp.', and slashes
            # This handles your "too many birds" issue by removing non-species taxa
            if any(x in bird_name.lower() for x in ["(hybrid)", " sp.", "/"]):
                continue

            bird_data.append([bird_name, frequency])

        # Write to CSV
        with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Common Name', 'Frequency (%)'])
            writer.writerows(bird_data)

        print(f"Success! Extracted {len(bird_data)} clean bird species to {output_csv}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Ensure 'Target Species - eBird.html' is in your directory
    rip_target_birds('Target Species - eBird.html', 'bc_common_birds.csv')