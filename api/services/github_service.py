"""
GitHub API service for server-side operations
"""

import aiohttp
import re
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class GitHubService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.github.com"
        
    def parse_github_url(self, github_url: str) -> Optional[Dict[str, str]]:
        """Parse GitHub URL to extract owner and repo"""
        # Handle both github.com and api.github.com URLs
        patterns = [
            r'github\.com/([^/]+)/([^/]+)',
            r'api\.github\.com/repos/([^/]+)/([^/]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, github_url)
            if match:
                return {
                    'owner': match.group(1),
                    'repo': match.group(2).replace('.git', '')
                }
        return None
        
    async def get_recent_releases(self, owner: str, repo: str, limit: int = 10) -> List[Any]:
        """Get recent releases from a GitHub repository"""
        url = f"{self.base_url}/repos/{owner}/{repo}/releases"
        headers = {
            'Authorization': f'token {self.api_key}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        params = {'per_page': limit}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, params=params) as response:
                    if response.status == 200:
                        releases = await response.json()
                        logger.info(f"Found {len(releases)} releases for {owner}/{repo}")
                        return releases
                    else:
                        logger.error(f"GitHub API error {response.status} for {owner}/{repo}")
                        return []
        except Exception as e:
            logger.error(f"Error fetching releases for {owner}/{repo}: {e}")
            return []