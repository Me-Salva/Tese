import json
from collections import defaultdict
import os
import re
import requests
import hashlib

# Download transfer files only if needed
def hash_json(data):
    """Create a hash of the JSON object (used to compare current vs new data)."""
    return hashlib.md5(json.dumps(data, sort_keys=True).encode('utf-8')).hexdigest()

print("\U0001F504 Checking for updates to transfer data...")

transfers_folder_path = "./src/files/transfers"
transfers_api_config = {
    "transfers_ALE.json": 11,
    "transfers_ARG.json": 70,
    "transfers_ASA.json": 518,
    "transfers_BEL.json": 15,
    "transfers_BRA.json": 51,
    "transfers_CHI.json": 117,
    "transfers_ESP.json": 5,
    "transfers_EUA.json": 25,
    "transfers_FRA.json": 13,
    "transfers_ING.json": 4,
    "transfers_ITA.json": 10,
    "transfers_MEX.json": 1485,
    "transfers_PBA.json": 12,
    "transfers_POR.json": 3,
    "transfers_TUR.json": 24
}

api_base_url = "http://direct.zerozero.pt/api/v1/getGraphPlayersTransfersCountryCompet"
app_key = "tY9Qv2xP"

for filename, compet_id in transfers_api_config.items():
    api_url = f"{api_base_url}/AppKey/{app_key}/competID/{compet_id}"
    output_path = os.path.join(transfers_folder_path, filename)

    try:
        # Get new data from API
        response = requests.get(api_url)
        response.raise_for_status()
        new_data = response.json()
        new_hash = hash_json(new_data)

        # Check if local file exists and is different
        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                try:
                    existing_data = json.load(f)
                    existing_hash = hash_json(existing_data)

                    if existing_hash == new_hash:
                        print(f"✅ {filename} is up-to-date.")
                        continue  # Skip writing
                except json.JSONDecodeError:
                    print(f"⚠️ Corrupted JSON in {filename}, will overwrite.")

        # Save new data
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)

        print(f"🔁 {filename} updated.")

    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to fetch {filename}: {e}")
    except Exception as e:
        print(f"❌ Unexpected error for {filename}: {e}")

print("✔️ Transfer files update check complete.\n")

# File paths configuration
map_file_path = './src/files/map.json'
output_folder_path = './src/files/arcs'
player_db_path = './src/files/players.json'

def extract_year(season_name):
    """Extract year from season name, using first year for season formats like '2017/2018'"""
    match = re.search(r'(\d{4})/(\d{4})', season_name)
    if match:
        return match.group(1)

    # Check for standalone year like "2018"
    match = re.search(r'\b(\d{4})\b', season_name)
    if match:
        return match.group(1)
    
    # Check for short year format like "17/18"
    match = re.search(r'\b(\d{2})/?(\d{2})?\b', season_name)
    if match:
        year = match.group(1)
        return f"20{year}" if int(year) < 50 else f"19{year}"
    
    # Check for mixed format like "2017/18"
    match = re.search(r'\b(\d{4})/?(\d{2})?\b', season_name)
    if match:
        return match.group(1)

    return None

# Load country coordinates from map file
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

# Dictionary to store country flag URLs
country_flags = {}

# Get all transfer JSON files
transfer_files = [f for f in os.listdir(transfers_folder_path) if f.endswith('.json')]

# Player database to store detailed player information
player_database = {}

# Track unique transfers to avoid duplicates
transfer_key_set = set()

# Process each transfer file
for transfer_file in transfer_files:
    transfer_file_path = os.path.join(transfers_folder_path, transfer_file)
    print(f"Processing file: {transfer_file}")
    
    # Extract destination country code from filename
    destination_country_code = transfer_file.split("_")[-1].split(".")[0]

    with open(transfer_file_path, 'r', encoding='utf-8') as f:
        transfers_data = json.load(f)

    seasons = transfers_data["data"]["seasons"]
    sorted_seasons = sorted(seasons.items(), key=lambda x: x[0])

    # Process each season
    for season_name, clubs in sorted_seasons:
        print(f"Processing season: {season_name}")
        year = extract_year(season_name)
        if not year:
            print(f"Warning: Could not extract year from season name: {season_name}")
            continue

        # Process each club
        for club in clubs:
            current_club_id = club.get("id")
            current_club_name = club.get("name")
            
            transfers_in = club.get("teams_in", {})
            transfers_out = club.get("teams_out", {})

            # Process incoming transfers
            if isinstance(transfers_in, dict):
                for country_id, transfer_info in transfers_in.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_country_code = country_info[int(country_id)]["code"]
                        
                        # Store flag URL if available
                        if "logo" in transfer_info and transfer_info["logo"]:
                            logo_url = transfer_info["logo"]
                            if origin_country_code and origin_country_code not in country_flags:
                                country_flags[origin_country_code] = logo_url
                        
                        if "players" in transfer_info:
                            players = transfer_info["players"]
                            # Handle players as dictionary
                            if isinstance(players, dict):
                                for player_id, player in players.items():
                                    # Create unique key for this transfer
                                    transfer_key = (
                                        player_id, 
                                        year, 
                                        origin_country_code, 
                                        destination_country_code,
                                        player.get("club_id"),
                                        current_club_id
                                    )
                                    
                                    # Skip if already processed
                                    if transfer_key in transfer_key_set:
                                        continue
                                    
                                    transfer_key_set.add(transfer_key)
                                    
                                    # Add player to database if not already there
                                    if player_id not in player_database:
                                        player_database[player_id] = {
                                            "id": player_id,
                                            "name": player["name"],
                                            "position": player.get("posicao", "Unknown"),
                                            "birthDate": player.get("dt_nascimento", "Unknown"),
                                            "transfers": [],
                                            "country_flags": {}
                                        }
                                    
                                    # Add transfer to player's history
                                    player_database[player_id]["transfers"].append({
                                        "year": year,
                                        "from_country": origin_country_code,
                                        "to_country": destination_country_code,
                                        "from_club_id": player.get("club_id"),
                                        "from_club_name": player.get("club_descr"),
                                        "to_club_id": current_club_id,
                                        "to_club_name": current_club_name
                                    })
                                    
                                    # Store country flags for this player
                                    if origin_country_code not in player_database[player_id]["country_flags"] and origin_country_code in country_flags:
                                        player_database[player_id]["country_flags"][origin_country_code] = country_flags[origin_country_code]
                                    
                                    if destination_country_code not in player_database[player_id]["country_flags"] and destination_country_code in country_flags:
                                        player_database[player_id]["country_flags"][destination_country_code] = country_flags[destination_country_code]
                            # Handle players as list
                            elif isinstance(players, list):
                                for player in players:
                                    if "name" in player and "id" in player:
                                        player_id = player["id"]
                                        transfer_key = (
                                            player_id, 
                                            year, 
                                            origin_country_code, 
                                            destination_country_code,
                                            player.get("club_id"),
                                            current_club_id
                                        )
                                        
                                        if transfer_key in transfer_key_set:
                                            continue
                                        
                                        transfer_key_set.add(transfer_key)
                                        
                                        if player_id not in player_database:
                                            player_database[player_id] = {
                                                "id": player_id,
                                                "name": player["name"],
                                                "position": player.get("posicao", "Unknown"),
                                                "birthDate": player.get("dt_nascimento", "Unknown"),
                                                "transfers": [],
                                                "country_flags": {}
                                            }
                                        
                                        player_database[player_id]["transfers"].append({
                                            "year": year,
                                            "from_country": origin_country_code,
                                            "to_country": destination_country_code,
                                            "from_club_id": player.get("club_id"),
                                            "from_club_name": player.get("club_descr"),
                                            "to_club_id": current_club_id,
                                            "to_club_name": current_club_name
                                        })
                                        
                                        if origin_country_code not in player_database[player_id]["country_flags"] and origin_country_code in country_flags:
                                            player_database[player_id]["country_flags"][origin_country_code] = country_flags[origin_country_code]
                                        
                                        if destination_country_code not in player_database[player_id]["country_flags"] and destination_country_code in country_flags:
                                            player_database[player_id]["country_flags"][destination_country_code] = country_flags[destination_country_code]

            # Process outgoing transfers
            if isinstance(transfers_out, dict):
                for country_id, transfer_info in transfers_out.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        destination_country_code_out = country_info[int(country_id)]["code"]
                        
                        if "logo" in transfer_info and transfer_info["logo"]:
                            logo_url = transfer_info["logo"]
                            if destination_country_code_out and destination_country_code_out not in country_flags:
                                country_flags[destination_country_code_out] = logo_url
                        
                        if "players" in transfer_info:
                            players = transfer_info["players"]
                            if isinstance(players, dict):
                                for player_id, player in players.items():
                                    transfer_key = (
                                        player_id, 
                                        year, 
                                        destination_country_code, 
                                        destination_country_code_out,
                                        current_club_id,
                                        player.get("club_id")
                                    )
                                    
                                    if transfer_key in transfer_key_set:
                                        continue
                                    
                                    transfer_key_set.add(transfer_key)
                                    
                                    if player_id not in player_database:
                                        player_database[player_id] = {
                                            "id": player_id,
                                            "name": player["name"],
                                            "position": player.get("posicao", "Unknown"),
                                            "birthDate": player.get("dt_nascimento", "Unknown"),
                                            "transfers": [],
                                            "country_flags": {}
                                        }
                                    
                                    player_database[player_id]["transfers"].append({
                                        "year": year,
                                        "from_country": destination_country_code,
                                        "to_country": destination_country_code_out,
                                        "from_club_id": current_club_id,
                                        "from_club_name": current_club_name,
                                        "to_club_id": player.get("club_id"),
                                        "to_club_name": player.get("club_descr")
                                    })
                                    
                                    if destination_country_code not in player_database[player_id]["country_flags"] and destination_country_code in country_flags:
                                        player_database[player_id]["country_flags"][destination_country_code] = country_flags[destination_country_code]
                                    
                                    if destination_country_code_out not in player_database[player_id]["country_flags"] and destination_country_code_out in country_flags:
                                        player_database[player_id]["country_flags"][destination_country_code_out] = country_flags[destination_country_code_out]
                            elif isinstance(players, list):
                                for player in players:
                                    if "name" in player and "id" in player:
                                        player_id = player["id"]
                                        transfer_key = (
                                            player_id, 
                                            year, 
                                            destination_country_code, 
                                            destination_country_code_out,
                                            current_club_id,
                                            player.get("club_id")
                                        )
                                        
                                        if transfer_key in transfer_key_set:
                                            continue
                                        
                                        transfer_key_set.add(transfer_key)
                                        
                                        if player_id not in player_database:
                                            player_database[player_id] = {
                                                "id": player_id,
                                                "name": player["name"],
                                                "position": player.get("posicao", "Unknown"),
                                                "birthDate": player.get("dt_nascimento", "Unknown"),
                                                "transfers": [],
                                                "country_flags": {}
                                            }
                                        
                                        player_database[player_id]["transfers"].append({
                                            "year": year,
                                            "from_country": destination_country_code,
                                            "to_country": destination_country_code_out,
                                            "from_club_id": current_club_id,
                                            "from_club_name": current_club_name,
                                            "to_club_id": player.get("club_id"),
                                            "to_club_name": player.get("club_descr")
                                        })
                                        
                                        if destination_country_code not in player_database[player_id]["country_flags"] and destination_country_code in country_flags:
                                            player_database[player_id]["country_flags"][destination_country_code] = country_flags[destination_country_code]
                                        
                                        if destination_country_code_out not in player_database[player_id]["country_flags"] and destination_country_code_out in country_flags:
                                            player_database[player_id]["country_flags"][destination_country_code_out] = country_flags[destination_country_code_out]

for player_id, player_data in player_database.items():
    for transfer in player_data["transfers"]:
        for code in [transfer["from_country"], transfer["to_country"]]:
            if code not in player_data["country_flags"] and code in country_flags:
                player_data["country_flags"][code] = country_flags[code]

# Deduplicate transfers for each player
for player_id, player_data in player_database.items():
    if "transfers" in player_data:
        unique_transfers = {}
        
        for transfer in player_data["transfers"]:
            # Create key that ignores year but includes all other relevant data
            transfer_key = (
                transfer["from_country"],
                transfer["to_country"],
                transfer.get("from_club_id", ""),
                transfer.get("to_club_id", "")
            )
            
            # Check for consecutive year duplicates
            if transfer_key in unique_transfers:
                existing_transfer = unique_transfers[transfer_key]
                year_diff = abs(int(existing_transfer["year"]) - int(transfer["year"]))
                
                # If years are consecutive (difference of 1), keep the earlier year
                if year_diff <= 1:
                    if int(transfer["year"]) < int(existing_transfer["year"]):
                        unique_transfers[transfer_key] = transfer
                else:
                    # If years are not consecutive, treat as separate transfer
                    new_key = transfer_key + (transfer["year"],)
                    unique_transfers[new_key] = transfer
            else:
                unique_transfers[transfer_key] = transfer
        
        # Replace original transfers with deduplicated ones
        player_data["transfers"] = list(unique_transfers.values())

# Handle players with the same name by adding birth year or index
player_name_map = defaultdict(list)
for player_id, player_data in player_database.items():
    player_name_map[player_data["name"]].append(player_id)

for name, ids in player_name_map.items():
    if len(ids) > 1:
        print(f"Found {len(ids)} players with name '{name}'")
        for i, player_id in enumerate(ids):
            player = player_database[player_id]
            birth_date = player.get("birthDate", "Unknown")
            
            if birth_date != "Unknown" and len(birth_date) >= 4:
                try:
                    birth_year = birth_date[:4]
                    player["display_name"] = f"{name} ({birth_year})"
                except:
                    player["display_name"] = f"{name} ({i+1})"
            else:
                player["display_name"] = f"{name} ({i+1})"
    else:
        player_database[ids[0]]["display_name"] = name

# Write player database to file
with open(player_db_path, 'w', encoding='utf-8') as f:
    json.dump({"players": player_database}, f, indent=4)

print(f"✅ Player database successfully generated with {len(player_database)} players!")

# Generate arcs based on the deduplicated player database
yearly_transfer_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {'count': 0, 'players': set(), 'player_ids': set()})))

# Rebuild transfer data from player database
for player_id, player_data in player_database.items():
    for transfer in player_data["transfers"]:
        year = transfer["year"]
        from_country = transfer["from_country"]
        to_country = transfer["to_country"]
        
        yearly_transfer_data[year][from_country][to_country]['players'].add(player_data["display_name"])
        yearly_transfer_data[year][from_country][to_country]['player_ids'].add(player_id)
        yearly_transfer_data[year][from_country][to_country]['count'] += 1

# Generate arc files for each year
for year, origin_data in yearly_transfer_data.items():
    arcs = []
    for origin_code, destination_data in origin_data.items():
        for destination_code, data in destination_data.items():
            player_count = len(data['players'])
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

                    arcs.append({
                        "type": "transfer",
                        "from": origin_code,
                        "to": destination_code,
                        "startLat": start_lat,
                        "startLong": start_long,
                        "endLat": end_lat,
                        "endLong": end_long,
                        "color": '#F76B15',
                        "scale": 0.5,
                        "count": count,
                        "players": players,
                        "player_ids": list(data['player_ids'])
                    })
    
    # Write arcs for this year if within valid range
    if 1950 <= int(year) <= 2025:
        lines_data = {
            "type": "Transfer",
            "arcs": arcs
        }
        output_filename = os.path.join(output_folder_path, f'lines_{year}.json')
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(lines_data, f, indent=4)

        print(f"✅ {output_filename} successfully generated with {len(arcs)} consolidated arcs!")

print("All files processed.")