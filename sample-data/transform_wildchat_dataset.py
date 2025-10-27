#!/usr/bin/env python3
"""
Transform Allen AI wildchat dataset to turn-level CSV format.

Downloads allenai/wildchat-r1-p2-format-filtered and converts from conversation
format to turn-level rows where each user-assistant exchange is a separate row.

The dataset has:
- messages: Regenerated conversations (use regenerated_by model)
- conversation: Original conversations (use model column)
- conversation_hash: Unique conversation ID (use as session_id)
- hashed_ip: User IP hash (use as user_id)
"""

import csv
import random
from datetime import datetime, timedelta
from datasets import load_dataset

# Token estimation (rough approximation based on character count)
def estimate_tokens(text):
    """Estimate token count as ~4 chars per token"""
    return len(text) // 4 if text else 0

# Cost estimation (rough USD per 1k tokens)
MODEL_COSTS = {
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "claude-2": {"input": 0.008, "output": 0.024},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    "deepseek-r1": {"input": 0.0014, "output": 0.0028},
}

def calculate_cost(model, prompt_tokens, completion_tokens):
    """Calculate cost in USD based on model pricing"""
    # Normalize model name to match cost dict
    model_key = model.lower()
    if "gpt-4" in model_key and "turbo" not in model_key:
        costs = MODEL_COSTS["gpt-4"]
    elif "gpt-4" in model_key and "turbo" in model_key:
        costs = MODEL_COSTS["gpt-4-turbo"]
    elif "gpt-3.5" in model_key:
        costs = MODEL_COSTS["gpt-3.5-turbo"]
    elif "claude-3" in model_key:
        costs = MODEL_COSTS["claude-3-sonnet"]
    elif "claude" in model_key:
        costs = MODEL_COSTS["claude-2"]
    elif "deepseek" in model_key:
        costs = MODEL_COSTS["deepseek-r1"]
    else:
        costs = {"input": 0.001, "output": 0.002}  # default

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

def extract_turns_from_messages(messages, conversation_hash, hashed_ip, model, base_timestamp):
    """
    Extract turn-level data from messages array.
    Messages format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    turns = []
    user_message = None
    turn_num = 1

    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "").strip()

        if not content:
            continue

        if role == "user":
            user_message = content
        elif role == "assistant" and user_message:
            # We have a complete user-assistant pair
            metadata = generate_synthetic_metadata(user_message, content, model)
            turn_timestamp = base_timestamp + timedelta(seconds=turn_num * 30)

            turns.append({
                "session_id": conversation_hash,
                "user_id": hashed_ip,
                "timestamp": turn_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "user_message": user_message,
                "assistant_message": content,
                "model": model,
                **metadata
            })

            user_message = None
            turn_num += 1

    return turns

def main():
    print("Loading wildchat dataset from HuggingFace...")
    print("This dataset is large (73,900 rows). Loading may take a few minutes...")

    # Load dataset - no token needed, it's public
    dataset = load_dataset("allenai/wildchat-r1-p2-format-filtered", split="train")

    print(f"Loaded {len(dataset)} conversations")

    # Prepare output data
    output_rows = []
    turn_id_counter = 1

    print("Transforming to turn-level format...")
    for idx, row in enumerate(dataset):
        conversation_hash = row.get("conversation_hash", f"conv_{idx}")
        hashed_ip = row.get("hashed_ip", f"user_{idx}")
        model = row.get("model", "unknown")

        # Try to get timestamp from row, fallback to synthetic
        if "timestamp" in row and row["timestamp"]:
            try:
                base_timestamp = datetime.fromisoformat(str(row["timestamp"]).replace('Z', '+00:00'))
            except:
                base_timestamp = datetime(2024, 1, 1) + timedelta(hours=idx)
        else:
            base_timestamp = datetime(2024, 1, 1) + timedelta(hours=idx)

        # Extract turns from messages array
        if "messages" in row and row["messages"]:
            turns = extract_turns_from_messages(
                row["messages"],
                conversation_hash,
                hashed_ip,
                model,
                base_timestamp
            )

            # Add turn_id to each turn
            for turn in turns:
                turn["turn_id"] = turn_id_counter
                turn_id_counter += 1
                output_rows.append(turn)

        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1} conversations, generated {len(output_rows)} turns")

    # Write to CSV
    output_file = "/Users/avinaash/Documents/FluffyViz/sample-data/wildchat-transformed.csv"
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
