import json
from collections import defaultdict
import os
import re

map_file_path = 'D:/Tese/Tese/test/src/files/map.json'
transfers_folder_path = 'D:/Tese/Tese/test/src/files/transfers'
output_folder_path = 'D:/Tese/Tese/test/src/files/arcs'

def extract_year(season_name):
    match = re.search(r'\b(\d{4})/?(\d{2})?\b', season_name)
    if match:
        year = match.group(2) or match.group(1)
        return f"20{year}" if len(year) == 2 and int(year) < 50 else f"19{year}" if len(year) == 2 else year

    match = re.search(r'\b(\d{2})\b', season_name)
    if match:
        year = int(match.group(1))
        return f"20{year}" if year < 50 else f"19{year}"

    return None

with open(map_file_path, 'r', encoding='utf-8') as f:
    map_data = json.load(f)

country_info = {
    entry["id"]: {
        "code": entry["text"],
        "lat": entry["lat"],
        "lng": entry["lng"]
    }
    for entry in map_data["coordinates"]
}

transfer_files = [f for f in os.listdir(transfers_folder_path) if f.endswith('.json')]

# Create a structure to track transfers by year, origin, and destination
# This will help us consolidate transfers from different files
yearly_transfer_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {'count': 0, 'players': set(), 'player_ids': set()})))

for transfer_file in transfer_files:
    transfer_file_path = os.path.join(transfers_folder_path, transfer_file)
    print(f"Processing file: {transfer_file}")

    with open(transfer_file_path, 'r', encoding='utf-8') as f:
        transfers_data = json.load(f)

    seasons = transfers_data["data"]["seasons"]
    sorted_seasons = sorted(seasons.items(), key=lambda x: x[0])

    for season_name, clubs in sorted_seasons:
        print(f"Processing season: {season_name}")

        year = extract_year(season_name)
        if not year:
            print(f"Warning: Could not extract year from season name: {season_name}")
            continue

        for club in clubs:
            transfers_in = club.get("teams_in", {})
            transfers_out = club.get("teams_out", {})

            # Process incoming transfers
            if isinstance(transfers_in, dict):
                for country_id, transfer_info in transfers_in.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = country_info[int(country_id)]["code"]
                        destination_code = transfer_file.split("_")[-1].split(".")[0]
                        
                        # Track player IDs to avoid duplicates
                        if "players" in transfer_info:
                            players = transfer_info["players"]
                            if isinstance(players, dict):
                                for player_id, player in players.items():
                                    if "name" in player:
                                        yearly_transfer_data[year][origin_code][destination_code]['players'].add(player["name"])
                                        yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(player_id)
                            elif isinstance(players, list):
                                for player in players:
                                    if "name" in player and "id" in player:
                                        yearly_transfer_data[year][origin_code][destination_code]['players'].add(player["name"])
                                        yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(player["id"])
                        else:
                            # If no players are specified, just increment the count
                            yearly_transfer_data[year][origin_code][destination_code]['count'] += int(transfer_info.get("count", 1))
            
            elif isinstance(transfers_in, list):
                for transfer_info in transfers_in:
                    country_id = transfer_info.get("country_id")
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = country_info[int(country_id)]["code"]
                        destination_code = transfer_file.split("_")[-1].split(".")[0]
                        
                        # Track player IDs
                        if "id" in transfer_info and "name" in transfer_info:
                            yearly_transfer_data[year][origin_code][destination_code]['players'].add(transfer_info["name"])
                            yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(transfer_info["id"])
                        else:
                            yearly_transfer_data[year][origin_code][destination_code]['count'] += 1

            # Process outgoing transfers
            if isinstance(transfers_out, dict):
                for country_id, transfer_info in transfers_out.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = transfer_file.split("_")[-1].split(".")[0]
                        destination_code = country_info[int(country_id)]["code"]
                        
                        # Track player IDs to avoid duplicates
                        if "players" in transfer_info:
                            players = transfer_info["players"]
                            if isinstance(players, dict):
                                for player_id, player in players.items():
                                    if "name" in player:
                                        yearly_transfer_data[year][origin_code][destination_code]['players'].add(player["name"])
                                        yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(player_id)
                            elif isinstance(players, list):
                                for player in players:
                                    if "name" in player and "id" in player:
                                        yearly_transfer_data[year][origin_code][destination_code]['players'].add(player["name"])
                                        yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(player["id"])
                        else:
                            # If no players are specified, just increment the count
                            yearly_transfer_data[year][origin_code][destination_code]['count'] += int(transfer_info.get("count", 1))
            
            elif isinstance(transfers_out, list):
                for transfer_info in transfers_out:
                    country_id = transfer_info.get("country_id")
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_code = transfer_file.split("_")[-1].split(".")[0]
                        destination_code = country_info[int(country_id)]["code"]
                        
                        # Track player IDs
                        if "id" in transfer_info and "name" in transfer_info:
                            yearly_transfer_data[year][origin_code][destination_code]['players'].add(transfer_info["name"])
                            yearly_transfer_data[year][origin_code][destination_code]['player_ids'].add(transfer_info["id"])
                        else:
                            yearly_transfer_data[year][origin_code][destination_code]['count'] += 1

# Now convert the consolidated data into arcs
yearly_arcs = defaultdict(list)

for year, origin_data in yearly_transfer_data.items():
    for origin_code, destination_data in origin_data.items():
        for destination_code, data in destination_data.items():
            # Use the number of unique players as the count
            player_count = len(data['players'])
            # If we have player data, use that count, otherwise use the accumulated count
            count = player_count if player_count > 0 else data['count']
            players = list(data['players'])
            
            if origin_code in {info["code"] for info in country_info.values()} and destination_code in {info["code"] for info in country_info.values()}:
                origin_id = next((id for id, info in country_info.items() if info["code"] == origin_code), None)
                destination_id = next((id for id, info in country_info.items() if info["code"] == destination_code), None)

                if origin_id and destination_id:
                    start_lat = country_info[origin_id]["lat"]
                    start_long = country_info[origin_id]["lng"]
                    end_lat = country_info[destination_id]["lat"]
                    end_long = country_info[destination_id]["lng"]

                    yearly_arcs[year].append({
                        "type": "transfer",
                        "from": origin_code,
                        "to": destination_code,
                        "startLat": start_lat,
                        "startLong": start_long,
                        "endLat": end_lat,
                        "endLong": end_long,
                        "color": '#FF0000',
                        "scale": 0.5,
                        "count": count,
                        "players": players
                    })
                else:
                    print(f"Warning: {origin_code} or {destination_code} not found in country_info")
            else:
                print(f"Warning: {origin_code} or {destination_code} not found in country_info")

# Write the consolidated arcs to files
for year, arcs in yearly_arcs.items():
    if 1951 <= int(year) <= 2025:
        lines_data = {
            "type": "Transfer",
            "arcs": arcs
        }
        output_filename = os.path.join(output_folder_path, f'lines_{year}.json')
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(lines_data, f, indent=4)

        print(f"✅ {output_filename} successfully generated with {len(arcs)} consolidated arcs!")

print("All files processed.")