#!/usr/bin/env python3
"""
Flask API server for organization search
Deploy this to Render to enable search functionality
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from weighted_search import search_clubs

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get CSV path from environment or use default
CSV_PATH = os.getenv('CSV_PATH', os.path.join(os.path.dirname(__file__), 'final.csv'))

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Search API is running'})

@app.route('/search', methods=['POST'])
def search():
    """Search endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        query = data.get('query', '')
        user_data = data.get('userData', {})
        
        if not query:
            return jsonify({'error': 'Missing query parameter'}), 400
        
        # Check if CSV file exists
        if not os.path.exists(CSV_PATH):
            return jsonify({
                'error': f'CSV file not found at {CSV_PATH}',
                'hint': 'Make sure final.csv is in the project root or set CSV_PATH environment variable'
            }), 500
        
        # Perform search
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

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'message': 'Organization Search API',
        'endpoints': {
            '/health': 'GET - Health check',
            '/search': 'POST - Search organizations'
        }
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

