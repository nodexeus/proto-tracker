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
        
    async def get_recent_releases(self, owner: str, repo: str, max_releases: int = 1000) -> List[Any]:
        """Get recent releases from a GitHub repository with pagination"""
        base_url = f"{self.base_url}/repos/{owner}/{repo}/releases"
        headers = {
            'Authorization': f'token {self.api_key}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        all_releases = []
        page = 1
        per_page = 100  # GitHub API maximum per_page for releases
        
        try:
            async with aiohttp.ClientSession() as session:
                while len(all_releases) < max_releases:
                    params = {
                        'per_page': per_page,
                        'page': page
                    }
                    
                    async with session.get(base_url, headers=headers, params=params) as response:
                        if response.status == 200:
                            releases = await response.json()
                            
                            # If no releases returned, we've reached the end
                            if not releases:
                                break
                                
                            all_releases.extend(releases)
                            
                            # If we got fewer than per_page, we've reached the end
                            if len(releases) < per_page:
                                break
                                
                            page += 1
                        elif response.status == 404:
                            logger.warning(f"Repository {owner}/{repo} not found or no releases")
                            break
                        else:
                            logger.error(f"GitHub API error {response.status} for {owner}/{repo}: {await response.text()}")
                            break
                
                # Trim to max_releases if we got more than requested
                if len(all_releases) > max_releases:
                    all_releases = all_releases[:max_releases]
                    
                logger.info(f"Found {len(all_releases)} releases for {owner}/{repo}")
                return all_releases
                
        except Exception as e:
            logger.error(f"Error fetching releases for {owner}/{repo}: {e}")
            return []
    
    async def get_recent_tags(self, owner: str, repo: str, max_tags: int = 1000) -> List[Any]:
        """Get recent tags from a GitHub repository with pagination"""
        base_url = f"{self.base_url}/repos/{owner}/{repo}/tags"
        headers = {
            'Authorization': f'token {self.api_key}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        all_tags = []
        page = 1
        per_page = 100  # GitHub API maximum per_page for tags
        
        try:
            async with aiohttp.ClientSession() as session:
                while len(all_tags) < max_tags:
                    params = {
                        'per_page': per_page,
                        'page': page
                    }
                    
                    async with session.get(base_url, headers=headers, params=params) as response:
                        if response.status == 200:
                            tags = await response.json()
                            
                            # If no tags returned, we've reached the end
                            if not tags:
                                break
                            
                            # Fetch commit dates for tags
                            enriched_tags = []
                            for tag in tags:
                                try:
                                    # Get commit information for this tag
                                    commit_sha = tag['commit']['sha']
                                    commit_url = f"{self.base_url}/repos/{owner}/{repo}/commits/{commit_sha}"
                                    
                                    async with session.get(commit_url, headers=headers) as commit_response:
                                        if commit_response.status == 200:
                                            commit_data = await commit_response.json()
                                            # Add commit date to tag
                                            tag['commit_date'] = commit_data['commit']['committer']['date']
                                        else:
                                            # Fallback to current time if we can't get commit date
                                            tag['commit_date'] = datetime.utcnow().isoformat() + 'Z'
                                            logger.warning(f"Could not fetch commit date for tag {tag['name']}, using current time")
                                except Exception as e:
                                    # Fallback to current time if any error occurs
                                    tag['commit_date'] = datetime.utcnow().isoformat() + 'Z'
                                    logger.warning(f"Error fetching commit date for tag {tag['name']}: {e}, using current time")
                                
                                enriched_tags.append(tag)
                                
                            all_tags.extend(enriched_tags)
                            
                            # If we got fewer than per_page, we've reached the end
                            if len(tags) < per_page:
                                break
                                
                            page += 1
                        elif response.status == 404:
                            logger.warning(f"Repository {owner}/{repo} not found or no tags")
                            break
                        else:
                            logger.error(f"GitHub API error {response.status} for {owner}/{repo}: {await response.text()}")
                            break
                
                # Trim to max_tags if we got more than requested
                if len(all_tags) > max_tags:
                    all_tags = all_tags[:max_tags]
                    
                logger.info(f"Found {len(all_tags)} tags for {owner}/{repo}")
                return all_tags
                
        except Exception as e:
            logger.error(f"Error fetching tags for {owner}/{repo}: {e}")
            return []