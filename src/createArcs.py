import json
from collections import defaultdict
import requests

with open('D:/Tese/Tese/test/src/files/map.json', 'r', encoding='utf-8') as f:
    map_data = json.load(f)

with open('D:/Tese/Tese/test/src/files/transfers/transfersPOR.json', 'r', encoding='utf-8') as f:
    transfers_data = json.load(f)

country_info = {
    entry["id"]: {
        "code": entry["text"],
        "lat": entry["lat"],
        "long": entry["long"]
    }
    for entry in map_data["coordinates"]
}

seasons = transfers_data["data"]["seasons"]

sorted_seasons = sorted(seasons.items(), key=lambda x: x[0])

for season_name, clubs in sorted_seasons:
    print(f"Processing season: {season_name}")

    year = season_name.split("/")[-1]
    if len(year) == 2:
        if int(year) < 50:
            year = "20" + year
        else:
            year = "19" + year
    elif len(year) == 4:
        year = year

    lines_data = {
        "type": "Transfer",
        "arcs": []
    }

    transfer_counts = defaultdict(int)

    for club in clubs:
        transfers_in = club.get("teams_in", {})
        transfers_out = club.get("teams_out", {})

        if isinstance(transfers_in, dict):
            for country_id, transfer_info in transfers_in.items():
                if not country_id or int(country_id) == 0:
                    continue
                if int(country_id) in country_info:
                    origin_code = country_info[int(country_id)]["code"]
                    destination_code = "POR"

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
                    destination_code = "POR"

                    transfer_counts[(origin_code, destination_code, "in")] += 1
                else:
                    print(f"Warning: Country ID '{country_id}' not found in map.json")

        if isinstance(transfers_out, dict):
            for country_id, transfer_info in transfers_out.items():
                if not country_id or int(country_id) == 0:
                    continue
                if int(country_id) in country_info:
                    origin_code = "POR"
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
                    origin_code = "POR"
                    destination_code = country_info[int(country_id)]["code"]

                    transfer_counts[(origin_code, destination_code, "out")] += 1
                else:
                    print(f"Warning: Country ID '{country_id}' not found in map.json")

    order = 1

    for (origin_code, destination_code, direction), count in transfer_counts.items():
        if origin_code in {info["code"] for info in country_info.values()} and destination_code in {info["code"] for info in country_info.values()}:

            origin_id = next((id for id, info in country_info.items() if info["code"] == origin_code), None)
            destination_id = next((id for id, info in country_info.items() if info["code"] == destination_code), None)

            if origin_id and destination_id:
                start_lat = country_info[origin_id]["lat"]
                start_long = country_info[origin_id]["long"]
                end_lat = country_info[destination_id]["lat"]
                end_long = country_info[destination_id]["long"]

                thickness = min(1.0, 0.1 + (count * 0.03))

                lines_data["arcs"].append({
                    "type": "transfer",
                    "order": order,
                    "from": origin_code,
                    "to": destination_code,
                    "startLat": start_lat,
                    "startLong": start_long,
                    "endLat": end_lat,
                    "endLong": end_long,
                    "thickness": thickness,
                    "color":'#FF0000'
                })
                order += 1
            else:
                print(f"Warning: {origin_code} or {destination_code} not found in country_info")
        else:
            print(f"Warning: {origin_code} or {destination_code} not found in country_info")

    output_filename = f'D:/Tese/Tese/test/src/files/arcs/lines_{year}.json'
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(lines_data, f, indent=4)

print("All seasons processed.")