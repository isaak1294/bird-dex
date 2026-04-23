import csv
from bs4 import BeautifulSoup

def extract_birds_to_csv(html_file, output_csv):
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        # Find all divs that are either a category heading or a bird subitem
        # This keeps them in the exact order they appear in the document
        elements = soup.find_all('div', class_=['item-heading', 'subitem'])

        bird_data = []
        current_category = "Unknown/Other"

        for el in elements:
            # Check if this element is a new category heading
            if 'item-heading' in el.get('class', []):
                current_category = el.get_text(strip=True)
            
            # Check if this element is a bird name
            elif 'subitem' in el.get('class', []):
                bird_name = el.get_text(strip=True)
                bird_data.append([bird_name, current_category])

        # Write the extracted data to a CSV file
        with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            # Add header row
            writer.writerow(['Bird Name', 'Category'])
            writer.writerows(bird_data)

        print(f"Successfully extracted {len(bird_data)} entries to {output_csv}")

    except FileNotFoundError:
        print(f"Error: {html_file} not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Ensure 'BCBirds.html' is in your current directory
    extract_birds_to_csv('BCBirds.html', 'bc_birds_list.csv')