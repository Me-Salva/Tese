import json
from collections import defaultdict
import os
import re

# Paths
map_file_path = 'D:/Tese/Tese/test/src/files/map.json'
transfers_folder_path = 'D:/Tese/Tese/test/src/files/transfers'
output_folder_path = 'D:/Tese/Tese/test/src/files/arcs'

# Function to extract year from season name
def extract_year(season_name):
    # Use regex to find all 4-digit years in the season name
    year_matches = re.findall(r'\b\d{4}\b', season_name)
    if year_matches:
        return year_matches[-1]  # Use the last 4-digit year found

    # Use regex to find 2-digit years in the season name
    year_matches = re.findall(r'\b\d{2}\b', season_name)
    if year_matches:
        year = year_matches[-1]  # Use the last 2-digit year found
        if int(year) < 50:
            return "20" + year
        else:
            return "19" + year

    # If no year is found, return None
    return None

# Load map data
with open(map_file_path, 'r', encoding='utf-8') as f:
    map_data = json.load(f)

# Extract country information
country_info = {
    entry["id"]: {
        "code": entry["text"],
        "lat": entry["lat"],
        "long": entry["long"]
    }
    for entry in map_data["coordinates"]
}

# Get list of transfer files in the transfers folder
transfer_files = [f for f in os.listdir(transfers_folder_path) if f.endswith('.json')]

# Dictionary to store arcs for each year
yearly_arcs = defaultdict(list)

# Process each transfer file
for transfer_file in transfer_files:
    transfer_file_path = os.path.join(transfers_folder_path, transfer_file)
    print(f"Processing file: {transfer_file}")

    # Load transfer data
    with open(transfer_file_path, 'r', encoding='utf-8') as f:
        transfers_data = json.load(f)

    # Extract seasons data
    seasons = transfers_data["data"]["seasons"]

    # Sort seasons chronologically
    sorted_seasons = sorted(seasons.items(), key=lambda x: x[0])

    # Process each season
    for season_name, clubs in sorted_seasons:
        print(f"Processing season: {season_name}")

        # Extract the year from the season name
        year = extract_year(season_name)
        if not year:
            print(f"Warning: Could not extract year from season name: {season_name}")
            continue

        # Count transfers for thickness calculation
        transfer_counts = defaultdict(int)

        # Process transfers_in and transfers_out for each club
        for club in clubs:
            transfers_in = club.get("teams_in", {})
            transfers_out = club.get("teams_out", {})

            # Process transfers_in
            if isinstance(transfers_in, dict):
                for country_id, transfer_info in transfers_in.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = country_info[int(country_id)]["code"]
                        destination_code = transfer_file.split("_")[-1].split(".")[0]
                        transfer_counts[(origin_code, destination_code, "in")] += 1
                    else:
                        print(f"Warning: Country ID '{country_id}' not found in map.json")
            elif isinstance(transfers_in, list):
                for transfer_info in transfers_in:
                    country_id = transfer_info.get("country_id")
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = country_info[int(country_id)]["code"]
                        destination_code = transfer_file.split("_")[-1].split(".")[0]
                        transfer_counts[(origin_code, destination_code, "in")] += 1
                    else:
                        print(f"Warning: Country ID '{country_id}' not found in map.json")

            # Process transfers_out
            if isinstance(transfers_out, dict):
                for country_id, transfer_info in transfers_out.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = transfer_file.split("_")[-1].split(".")[0]
                        destination_code = country_info[int(country_id)]["code"]
                        transfer_counts[(origin_code, destination_code, "out")] += 1
                    else:
                        print(f"Warning: Country ID '{country_id}' not found in map.json")
            elif isinstance(transfers_out, list):
                for transfer_info in transfers_out:
                    country_id = transfer_info.get("country_id")
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = transfer_file.split("_")[-1].split(".")[0]
                        destination_code = country_info[int(country_id)]["code"]
                        transfer_counts[(origin_code, destination_code, "out")] += 1
                    else:
                        print(f"Warning: Country ID '{country_id}' not found in map.json")

        # Create arcs for the season
        for (origin_code, destination_code, direction), count in transfer_counts.items():
            if origin_code in {info["code"] for info in country_info.values()} and destination_code in {info["code"] for info in country_info.values()}:

                origin_id = next((id for id, info in country_info.items() if info["code"] == origin_code), None)
                destination_id = next((id for id, info in country_info.items() if info["code"] == destination_code), None)

                if origin_id and destination_id:
                    start_lat = country_info[origin_id]["lat"]
                    start_long = country_info[origin_id]["long"]
                    end_lat = country_info[destination_id]["lat"]
                    end_long = country_info[destination_id]["long"]

                    thickness = min(1.0, 0.1 + (count * 0.05))  # Calculate thickness

                    yearly_arcs[year].append({
                        "type": "transfer",
                        "from": origin_code,
                        "to": destination_code,
                        "startLat": start_lat,
                        "startLong": start_long,
                        "endLat": end_lat,
                        "endLong": end_long,
                        "thickness": thickness,
                        "color": '#FF0000'  # Default color, adjust as needed
                    })
                else:
                    print(f"Warning: {origin_code} or {destination_code} not found in country_info")
            else:
                print(f"Warning: {origin_code} or {destination_code} not found in country_info")

# Save arcs for each year to a JSON file
for year, arcs in yearly_arcs.items():
    if 1951 <= int(year) <= 2025:
        lines_data = {
            "type": "Transfer",
            "arcs": arcs
        }
        output_filename = os.path.join(output_folder_path, f'lines_{year}.json')
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(lines_data, f, indent=4)

    print(f"✅ {output_filename} successfully generated!")

print("All files processed.")