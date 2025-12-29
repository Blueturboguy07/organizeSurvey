from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# Add scripts directory to path
scripts_path = os.path.join(os.path.dirname(__file__), '..', 'scripts')
sys.path.insert(0, scripts_path)

# Import the search function
from weighted_search import search_clubs

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            
            query = body.get('query')
            user_data = body.get('userData', {})
            
            if not query:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing query'}).encode())
                return
            
            # Get file paths (relative to project root)
            csv_path = os.path.join(os.path.dirname(__file__), '..', 'final.csv')
            embeddings_path = os.path.join(os.path.dirname(__file__), '..', 'organizations_embeddings.pkl')
            
            # Verify files exist
            if not os.path.exists(csv_path):
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'CSV file not found: {csv_path}'}).encode())
                return
            
            # Perform search (top_n=0 to get all results with nonzero scores)
            results = search_clubs(query, user_data, csv_path, top_n=0)
            
            # Return results
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'results': results}).encode())
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            traceback_str = traceback.format_exc()
            print(f"Python API Error: {error_msg}")
            print(traceback_str)
            
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': error_msg}).encode())

