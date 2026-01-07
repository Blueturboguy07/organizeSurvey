#!/usr/bin/env python3
"""
Flask API server for organization search
Supports both Supabase database and CSV file as data source.

Deploy this to Render to enable search functionality.

Environment variables:
    SUPABASE_URL - Supabase project URL (for database mode)
    SUPABASE_SERVICE_KEY - Supabase service role key (for database mode)
    USE_SUPABASE - Set to 'true' to use Supabase (default: false, uses CSV)
    CSV_PATH - Path to CSV file (for CSV mode, default: ./final.csv)
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars are set directly

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from weighted_search import search_clubs, search_clubs_supabase

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
USE_SUPABASE = os.getenv('USE_SUPABASE', 'false').lower() == 'true'
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
CSV_PATH = os.getenv('CSV_PATH', os.path.join(os.path.dirname(__file__), 'final.csv'))

# Initialize Supabase client if configured
supabase_client = None
if USE_SUPABASE:
    try:
        from supabase import create_client
        if SUPABASE_URL and SUPABASE_SERVICE_KEY:
            supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            print(f"✅ Connected to Supabase: {SUPABASE_URL}", file=sys.stderr)
        else:
            print("⚠️ USE_SUPABASE=true but credentials missing, falling back to CSV", file=sys.stderr)
            USE_SUPABASE = False
    except ImportError:
        print("⚠️ supabase-py not installed, falling back to CSV", file=sys.stderr)
        USE_SUPABASE = False
    except Exception as e:
        print(f"⚠️ Failed to connect to Supabase: {e}, falling back to CSV", file=sys.stderr)
        USE_SUPABASE = False


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    data_source = 'supabase' if USE_SUPABASE and supabase_client else 'csv'
    return jsonify({
        'status': 'ok',
        'message': 'Search API is running',
        'data_source': data_source
    })


@app.route('/search', methods=['POST'])
def search():
    """Search endpoint - searches organizations by query and filters by user data"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        query = data.get('query', '')
        user_data = data.get('userData', {})
        
        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400
        
        # Use Supabase if configured, otherwise fall back to CSV
        if USE_SUPABASE and supabase_client:
            results = search_clubs_supabase(query, user_data, supabase_client, top_n=0)
        else:
            # Check if CSV file exists
            if not os.path.exists(CSV_PATH):
                return jsonify({
                    'error': f'CSV file not found at {CSV_PATH}',
                    'hint': 'Make sure final.csv is in the project root or set CSV_PATH environment variable'
                }), 500
            
            # Perform search using CSV
            results = search_clubs(query, user_data, CSV_PATH, top_n=0)
        
        return jsonify({'results': results})
    
    except Exception as e:
        print(f'Error in search endpoint: {str(e)}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500


@app.route('/organizations', methods=['GET'])
def list_organizations():
    """List all organizations (paginated)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        per_page = min(per_page, 100)  # Max 100 per page
        
        if USE_SUPABASE and supabase_client:
            # Fetch from Supabase with pagination
            offset = (page - 1) * per_page
            result = supabase_client.table('organizations') \
                .select('*') \
                .range(offset, offset + per_page - 1) \
                .execute()
            
            # Get total count
            count_result = supabase_client.table('organizations') \
                .select('id', count='exact') \
                .execute()
            total = count_result.count if hasattr(count_result, 'count') else len(result.data)
            
            return jsonify({
                'organizations': result.data,
                'page': page,
                'per_page': per_page,
                'total': total,
                'data_source': 'supabase'
            })
        else:
            # Load from CSV
            import pandas as pd
            df = pd.read_csv(CSV_PATH)
            total = len(df)
            
            # Paginate
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            df_page = df.iloc[start_idx:end_idx]
            
            # Convert to list of dicts
            organizations = df_page.fillna('').to_dict('records')
            
            return jsonify({
                'organizations': organizations,
                'page': page,
                'per_page': per_page,
                'total': total,
                'data_source': 'csv'
            })
    
    except Exception as e:
        print(f'Error in list_organizations: {str(e)}', file=sys.stderr)
        return jsonify({'error': str(e)}), 500


@app.route('/organizations/<org_id>', methods=['GET'])
def get_organization(org_id):
    """Get a single organization by ID or name"""
    try:
        if USE_SUPABASE and supabase_client:
            # Try by UUID first
            try:
                result = supabase_client.table('organizations') \
                    .select('*') \
                    .eq('id', org_id) \
                    .single() \
                    .execute()
                return jsonify({'organization': result.data})
            except:
                # Try by name
                result = supabase_client.table('organizations') \
                    .select('*') \
                    .ilike('name', f'%{org_id}%') \
                    .limit(1) \
                    .execute()
                
                if result.data:
                    return jsonify({'organization': result.data[0]})
                return jsonify({'error': 'Organization not found'}), 404
        else:
            # Search in CSV by name
            import pandas as pd
            df = pd.read_csv(CSV_PATH)
            matches = df[df['name'].str.contains(org_id, case=False, na=False)]
            
            if len(matches) > 0:
                org = matches.iloc[0].fillna('').to_dict()
                return jsonify({'organization': org})
            return jsonify({'error': 'Organization not found'}), 404
    
    except Exception as e:
        print(f'Error in get_organization: {str(e)}', file=sys.stderr)
        return jsonify({'error': str(e)}), 500


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    data_source = 'supabase' if USE_SUPABASE and supabase_client else 'csv'
    return jsonify({
        'message': 'Organization Search API',
        'data_source': data_source,
        'endpoints': {
            '/health': 'GET - Health check',
            '/search': 'POST - Search organizations',
            '/organizations': 'GET - List all organizations (paginated)',
            '/organizations/<id>': 'GET - Get organization by ID or name'
        }
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    print("=" * 60)
    print("Organization Search API Server")
    print("=" * 60)
    print(f"Data source: {'Supabase' if USE_SUPABASE and supabase_client else 'CSV'}")
    if not USE_SUPABASE:
        print(f"CSV path: {CSV_PATH}")
    print(f"Starting server on port {port}...")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=port, debug=False)
