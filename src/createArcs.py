import json
from collections import defaultdict
import os
import re

map_file_path = 'D:/Tese/Tese/test/src/files/map.json'
transfers_folder_path = 'D:/Tese/Tese/test/src/files/transfers'
output_folder_path = 'D:/Tese/Tese/test/src/files/arcs'
player_db_path = 'D:/Tese/Tese/test/src/files/players.json'

def extract_year(season_name):
    match = re.search(r'(\d{4})/(\d{4})', season_name)
    if match:
        return match.group(1)

    match = re.search(r'\b(\d{4})\b', season_name)
    if match:
        return match.group(1)

    match = re.search(r'\b(\d{2})/?(\d{2})?\b', season_name)
    if match:
        year = match.group(1)
        return f"20{year}" if int(year) < 50 else f"19{year}"
    
    match = re.search(r'\b(\d{4})/?(\d{2})?\b', season_name)
    if match:
        return match.group(1)

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

# Create a player database to store detailed player information
player_database = {}

# We'll use this to track unique transfers by player, year, from country, to country, and clubs
transfer_key_set = set()

for transfer_file in transfer_files:
    transfer_file_path = os.path.join(transfers_folder_path, transfer_file)
    print(f"Processing file: {transfer_file}")
    
    # Extract the destination country code from filename (e.g., "transfersESP.json" -> "ESP")
    destination_country_code = transfer_file.split("_")[-1].split(".")[0]

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
            current_club_id = club.get("id")
            current_club_name = club.get("name")
            
            transfers_in = club.get("teams_in", {})
            transfers_out = club.get("teams_out", {})

            # Process incoming transfers (players coming to this club)
            if isinstance(transfers_in, dict):
                for country_id, transfer_info in transfers_in.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        origin_country_code = country_info[int(country_id)]["code"]
                        
                        if "players" in transfer_info:
                            players = transfer_info["players"]
                            if isinstance(players, dict):
                                for player_id, player in players.items():
                                    # Create a unique key for this transfer
                                    transfer_key = (
                                        player_id, 
                                        year, 
                                        origin_country_code, 
                                        destination_country_code,
                                        player.get("club_id"),  # origin club id
                                        current_club_id        # destination club id
                                    )
                                    
                                    # Skip if we've already processed this transfer
                                    if transfer_key in transfer_key_set:
                                        continue
                                    
                                    transfer_key_set.add(transfer_key)
                                    
                                    # Store player in database if not already there
                                    if player_id not in player_database:
                                        player_database[player_id] = {
                                            "id": player_id,
                                            "name": player["name"],
                                            "position": player.get("posicao", "Unknown"),
                                            "birthDate": player.get("dt_nascimento", "Unknown"),
                                            "transfers": []
                                        }
                                    
                                    # Add this transfer to player's history
                                    player_database[player_id]["transfers"].append({
                                        "year": year,
                                        "from_country": origin_country_code,
                                        "to_country": destination_country_code,
                                        "from_club_id": player.get("club_id"),
                                        "from_club_name": player.get("club_descr"),
                                        "to_club_id": current_club_id,
                                        "to_club_name": current_club_name
                                    })
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
                                        
                                        # Skip if we've already processed this transfer
                                        if transfer_key in transfer_key_set:
                                            continue
                                        
                                        transfer_key_set.add(transfer_key)
                                        
                                        # Store player in database
                                        if player_id not in player_database:
                                            player_database[player_id] = {
                                                "id": player_id,
                                                "name": player["name"],
                                                "position": player.get("posicao", "Unknown"),
                                                "birthDate": player.get("dt_nascimento", "Unknown"),
                                                "transfers": []
                                            }
                                        
                                        # Add this transfer to player's history
                                        player_database[player_id]["transfers"].append({
                                            "year": year,
                                            "from_country": origin_country_code,
                                            "to_country": destination_country_code,
                                            "from_club_id": player.get("club_id"),
                                            "from_club_name": player.get("club_descr"),
                                            "to_club_id": current_club_id,
                                            "to_club_name": current_club_name
                                        })

            # Process outgoing transfers (players leaving this club)
            if isinstance(transfers_out, dict):
                for country_id, transfer_info in transfers_out.items():
                    if not country_id or int(country_id) == 0:
                        continue
                    if int(country_id) in country_info:
                        destination_country_code_out = country_info[int(country_id)]["code"]
                        
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
                                    
                                    # Skip if we've already processed this transfer
                                    if transfer_key in transfer_key_set:
                                        continue
                                    
                                    transfer_key_set.add(transfer_key)
                                    
                                    # Store player in database if not already there
                                    if player_id not in player_database:
                                        player_database[player_id] = {
                                            "id": player_id,
                                            "name": player["name"],
                                            "position": player.get("posicao", "Unknown"),
                                            "birthDate": player.get("dt_nascimento", "Unknown"),
                                            "transfers": []
                                        }
                                    
                                    # Add this transfer to player's history
                                    player_database[player_id]["transfers"].append({
                                        "year": year,
                                        "from_country": destination_country_code,
                                        "to_country": destination_country_code_out,
                                        "from_club_id": current_club_id,
                                        "from_club_name": current_club_name,
                                        "to_club_id": player.get("club_id"),
                                        "to_club_name": player.get("club_descr")
                                    })
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
                                        
                                        # Skip if we've already processed this transfer
                                        if transfer_key in transfer_key_set:
                                            continue
                                        
                                        transfer_key_set.add(transfer_key)
                                        
                                        # Store player in database
                                        if player_id not in player_database:
                                            player_database[player_id] = {
                                                "id": player_id,
                                                "name": player["name"],
                                                "position": player.get("posicao", "Unknown"),
                                                "birthDate": player.get("dt_nascimento", "Unknown"),
                                                "transfers": []
                                            }
                                        
                                        # Add this transfer to player's history
                                        player_database[player_id]["transfers"].append({
                                            "year": year,
                                            "from_country": destination_country_code,
                                            "to_country": destination_country_code_out,
                                            "from_club_id": current_club_id,
                                            "from_club_name": current_club_name,
                                            "to_club_id": player.get("club_id"),
                                            "to_club_name": player.get("club_descr")
                                        })

# Process players with the same name
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

# Write the player database to a file
with open(player_db_path, 'w', encoding='utf-8') as f:
    json.dump({"players": player_database}, f, indent=4)

print(f"✅ Player database successfully generated with {len(player_database)} players!")

# Now generate arcs based on the player database (to ensure we're using deduplicated data)
yearly_transfer_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {'count': 0, 'players': set(), 'player_ids': set()})))

# Rebuild transfer data from the deduplicated player database
for player_id, player_data in player_database.items():
    for transfer in player_data["transfers"]:
        year = transfer["year"]
        from_country = transfer["from_country"]
        to_country = transfer["to_country"]
        
        yearly_transfer_data[year][from_country][to_country]['players'].add(player_data["display_name"])
        yearly_transfer_data[year][from_country][to_country]['player_ids'].add(player_id)
        yearly_transfer_data[year][from_country][to_country]['count'] += 1

# Generate arcs
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
    
    # Write arcs for this year
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