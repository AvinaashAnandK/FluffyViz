#!/usr/bin/env python3
"""
Create a subset of wildchat-transformed.csv with:
- 500 conversations total
- 60% (300) single-turn conversations
- 40% (200) multi-turn conversations
"""

import csv
import random
from collections import defaultdict

# Increase CSV field size limit for large fields
csv.field_size_limit(10000000)

def main():
    input_file = "/Users/avinaash/Documents/FluffyViz/sample-data/wildchat-transformed.csv"
    output_file = "/Users/avinaash/Documents/FluffyViz/sample-data/wildchat-subset-500.csv"

    print("Reading wildchat dataset...")

    # Group rows by session_id
    conversations = defaultdict(list)
    fieldnames = None

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for idx, row in enumerate(reader):
            session_id = row['session_id']
            conversations[session_id].append(row)

            if (idx + 1) % 50000 == 0:
                print(f"  Processed {idx + 1} rows, found {len(conversations)} unique conversations...")

    print(f"\nTotal conversations: {len(conversations)}")

    # Separate single-turn vs multi-turn
    single_turn = []
    multi_turn = []

    for session_id, turns in conversations.items():
        if len(turns) == 1:
            single_turn.append(session_id)
        else:
            multi_turn.append(session_id)

    print(f"Single-turn conversations: {len(single_turn)}")
    print(f"Multi-turn conversations: {len(multi_turn)}")

    # Sample the required number
    target_single = 300
    target_multi = 200

    if len(single_turn) < target_single:
        print(f"\n⚠️  Warning: Only {len(single_turn)} single-turn conversations available (need {target_single})")
        target_single = len(single_turn)

    if len(multi_turn) < target_multi:
        print(f"\n⚠️  Warning: Only {len(multi_turn)} multi-turn conversations available (need {target_multi})")
        target_multi = len(multi_turn)

    print(f"\nSampling {target_single} single-turn and {target_multi} multi-turn conversations...")

    random.seed(42)  # For reproducibility
    selected_single = random.sample(single_turn, target_single)
    selected_multi = random.sample(multi_turn, target_multi)
    selected_sessions = set(selected_single + selected_multi)

    print(f"Selected {len(selected_sessions)} conversations total")

    # Collect all rows for selected conversations
    output_rows = []
    for session_id in selected_sessions:
        output_rows.extend(conversations[session_id])

    # Sort by turn_id to maintain order
    output_rows.sort(key=lambda x: int(x['turn_id']))

    # Renumber turn_ids to be sequential
    for idx, row in enumerate(output_rows, start=1):
        row['turn_id'] = str(idx)

    # Write subset to new file
    print(f"\nWriting {len(output_rows)} turns to {output_file}...")

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"✓ Successfully created {output_file}")
    print(f"  Total conversations: {len(selected_sessions)}")
    print(f"  Single-turn: {target_single}")
    print(f"  Multi-turn: {target_multi}")
    print(f"  Total turns: {len(output_rows)}")
    print(f"  Average turns per conversation: {len(output_rows) / len(selected_sessions):.2f}")

if __name__ == "__main__":
    main()
