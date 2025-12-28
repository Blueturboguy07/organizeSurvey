#!/usr/bin/env python3
import pandas as pd
import numpy as np
import pickle
import os
from sentence_transformers import SentenceTransformer

def load_and_process_data(csv_path):
    df = pd.read_csv(csv_path)
    
    df_temp = df.copy()
    
    for col in df_temp.columns:
        df_temp[col] = df_temp[col].fillna('')
        df_temp[col] = df_temp[col].astype(str)
        df_temp[col] = df_temp[col].replace('nan', '')
        df_temp[col] = df_temp[col].replace('None', '')
    
    df['combined_text'] = df_temp.agg(' '.join, axis=1)
    df['combined_text'] = df['combined_text'].str.replace(r'\s+', ' ', regex=True).str.strip()
    
    return df

def generate_embeddings(csv_path='organizations_detailed.csv'):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    print("Loading and processing data...")
    df = load_and_process_data(csv_path)
    
    if len(df) == 0:
        raise ValueError("No data found in CSV file")
    
    print(f"Processing {len(df)} organizations...")
    
    print("Loading sentence transformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Generating embeddings (this may take a few minutes)...")
    # Generate embeddings in batches for better performance
    batch_size = 32
    embeddings_list = []
    for i in range(0, len(df), batch_size):
        batch = df['combined_text'].iloc[i:i+batch_size].tolist()
        batch_embeddings = model.encode(batch, show_progress_bar=True)
        embeddings_list.extend(batch_embeddings)
        if (i + batch_size) % 100 == 0:
            print(f"Processed {min(i + batch_size, len(df))} / {len(df)} organizations...")
    
    df['text_embeddings'] = embeddings_list
    
    # Save the embeddings
    embeddings_path = os.path.join(os.path.dirname(csv_path), 'organizations_embeddings.pkl')
    with open(embeddings_path, 'wb') as f:
        pickle.dump({'embeddings': df['text_embeddings']}, f)
    
    print(f"✓ Embeddings saved to {embeddings_path}")
    print(f"✓ Total organizations processed: {len(df)}")
    return embeddings_path

if __name__ == '__main__':
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'organizations_detailed.csv'
    try:
        generate_embeddings(csv_path)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

