#!/usr/bin/env python3
"""
Transform HuggingFace multi-turn dataset to turn-level CSV format.

Downloads SoftAge-AI/multi-turn_dataset and converts from wide format
(P1, R1, P2, R2, P3, R3, P4, R4, P5 columns) to long format where each
turn is a separate row with session_id grouping.

Usage:
  export HF_TOKEN=your_token_here
  python transform_huggingface_dataset.py

Or pass token as argument:
  python transform_huggingface_dataset.py hf_your_token_here

Get your token from: https://huggingface.co/settings/tokens
You must also accept the dataset terms at: https://huggingface.co/datasets/SoftAge-AI/multi-turn_dataset
"""

import csv
import os
import sys
import random
from datetime import datetime, timedelta
from datasets import load_dataset

# Models to randomly assign
MODELS = ["gpt-4", "gpt-3.5-turbo", "claude-2", "claude-instant"]

# Token estimation (rough approximation based on character count)
def estimate_tokens(text):
    """Estimate token count as ~4 chars per token"""
    return len(text) // 4 if text else 0

# Cost estimation (rough USD per 1k tokens)
MODEL_COSTS = {
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
    "claude-2": {"input": 0.008, "output": 0.024},
    "claude-instant": {"input": 0.0016, "output": 0.0055},
}

def calculate_cost(model, prompt_tokens, completion_tokens):
    """Calculate cost in USD based on model pricing"""
    costs = MODEL_COSTS.get(model, {"input": 0.001, "output": 0.002})
    return (prompt_tokens / 1000 * costs["input"]) + (completion_tokens / 1000 * costs["output"])

def generate_synthetic_metadata(user_message, assistant_message, model):
    """Generate synthetic token counts, latency, and cost"""
    prompt_tokens = estimate_tokens(user_message)
    completion_tokens = estimate_tokens(assistant_message)
    total_tokens = prompt_tokens + completion_tokens

    # Simulate latency (roughly 100ms per token generated + base latency)
    latency_ms = random.randint(1000, 2000) + (completion_tokens * random.randint(80, 120))

    cost_usd = calculate_cost(model, prompt_tokens, completion_tokens)

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "latency_ms": latency_ms,
        "cost_usd": round(cost_usd, 5)
    }

def main():
    # Get HuggingFace token from environment or command line
    token = os.environ.get("HF_TOKEN")
    if len(sys.argv) > 1:
        token = sys.argv[1]

    if not token:
        print("ERROR: HuggingFace token required!")
        print("\nThis dataset is gated. You need to:")
        print("1. Get a token from: https://huggingface.co/settings/tokens")
        print("2. Accept terms at: https://huggingface.co/datasets/SoftAge-AI/multi-turn_dataset")
        print("\nThen run:")
        print("  export HF_TOKEN=your_token_here")
        print("  python transform_huggingface_dataset.py")
        print("\nOr:")
        print("  python transform_huggingface_dataset.py hf_your_token_here")
        sys.exit(1)

    print("Loading dataset from HuggingFace...")
    dataset = load_dataset("SoftAge-AI/multi-turn_dataset", split="train", token=token)

    print(f"Loaded {len(dataset)} conversations")

    # Prepare output data
    output_rows = []
    turn_id_counter = 1
    base_timestamp = datetime(2024, 1, 15, 10, 0, 0)

    print("Transforming to turn-level format...")
    for idx, row in enumerate(dataset):
        session_id = f"sess_{idx + 1:05d}"
        user_id = f"user_{random.randint(100, 999)}"
        model = random.choice(MODELS)

        # Generate timestamp for this session
        session_timestamp = base_timestamp + timedelta(minutes=idx * 5)

        # Process P1-P4 and R1-R4 (excluding P5 as requested)
        turns = []
        for turn_num in range(1, 5):  # P1/R1 through P4/R4
            p_col = f"P{turn_num}"
            r_col = f"R{turn_num}"

            # Check if both prompt and response exist
            if p_col in row and r_col in row and row[p_col] and row[r_col]:
                user_message = str(row[p_col]).strip()
                assistant_message = str(row[r_col]).strip()

                if user_message and assistant_message:
                    # Generate metadata
                    metadata = generate_synthetic_metadata(user_message, assistant_message, model)

                    # Create turn timestamp (1 minute apart within session)
                    turn_timestamp = session_timestamp + timedelta(minutes=turn_num - 1)

                    turns.append({
                        "turn_id": turn_id_counter,
                        "session_id": session_id,
                        "user_id": user_id,
                        "timestamp": turn_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "user_message": user_message,
                        "assistant_message": assistant_message,
                        "model": model,
                        **metadata
                    })
                    turn_id_counter += 1

        output_rows.extend(turns)

        if (idx + 1) % 100 == 0:
            print(f"Processed {idx + 1} conversations, generated {len(output_rows)} turns")

    # Write to CSV
    output_file = "/Users/avinaash/Documents/FluffyViz/sample-data/multi-turn-transformed.csv"
    print(f"\nWriting {len(output_rows)} turns to {output_file}...")

    fieldnames = [
        "turn_id", "session_id", "user_id", "timestamp",
        "user_message", "assistant_message", "model",
        "prompt_tokens", "completion_tokens", "total_tokens",
        "latency_ms", "cost_usd"
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"✓ Successfully created {output_file}")
    print(f"  Total conversations: {len(dataset)}")
    print(f"  Total turns: {len(output_rows)}")
    print(f"  Average turns per conversation: {len(output_rows) / len(dataset):.2f}")

if __name__ == "__main__":
    main()
