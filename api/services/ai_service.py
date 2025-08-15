"""
AI Service for intelligent analysis of protocol updates and release notes
"""

import logging
import re
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
import aiohttp
import asyncio
from enum import Enum

logger = logging.getLogger(__name__)

class AIProvider(Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"

@dataclass
class AIAnalysisResult:
    """Result of AI analysis on release notes"""
    summary: str
    key_changes: List[str]
    breaking_changes: List[str]
    security_updates: List[str]
    upgrade_priority: str  # "critical", "high", "medium", "low"
    risk_assessment: str
    technical_summary: str
    executive_summary: str
    estimated_impact: str
    confidence_score: float  # 0.0 to 1.0
    # Hard fork specific fields
    is_hard_fork: bool
    hard_fork_details: Optional[str]
    activation_block: Optional[int]
    activation_date: Optional[str]
    coordination_required: bool

class AIService:
    """Service for AI-powered analysis of protocol updates and release notes"""
    
    def __init__(self, provider: AIProvider = AIProvider.OPENAI, api_key: Optional[str] = None, 
                 model: Optional[str] = None, base_url: Optional[str] = None):
        self.provider = provider
        self.api_key = api_key
        self.model = model or self._get_default_model()
        self.base_url = base_url or self._get_default_base_url()
        
    def _get_default_model(self) -> str:
        """Get default model for the provider"""
        if self.provider == AIProvider.OPENAI:
            return "gpt-5"
        elif self.provider == AIProvider.ANTHROPIC:
            return "claude-sonnet-4-20250514"
        else:
            return "llama2"  # Default local model
            
    def _get_default_base_url(self) -> str:
        """Get default base URL for the provider"""
        if self.provider == AIProvider.OPENAI:
            return "https://api.openai.com/v1"
        elif self.provider == AIProvider.ANTHROPIC:
            return "https://api.anthropic.com/v1"
        else:
            return "http://localhost:11434/v1"  # Ollama default
    
    def _build_analysis_prompt(self, protocol_name: str, client_name: str, 
                              release_title: str, release_notes: str, 
                              tag_name: str, is_prerelease: bool = False,
                              previous_analysis: Optional[str] = None) -> str:
        """Build the prompt for AI analysis"""
        
        context = f"""You are an expert blockchain protocol analyst. Analyze the following release information for {protocol_name} protocol, {client_name} client.

RELEASE INFORMATION:
- Release Title: {release_title}
- Tag/Version: {tag_name}
- Is Prerelease: {is_prerelease}
- Release Notes: {release_notes}

"""
        
        if previous_analysis:
            context += f"PREVIOUS ANALYSIS FOR CONTEXT:\n{previous_analysis}\n\n"
        
        context += """ANALYSIS REQUIREMENTS:
Please analyze this release and provide a JSON response with the following structure:

{
  "summary": "Brief 2-3 sentence overview of this release",
  "key_changes": ["List of 3-5 most important changes"],
  "breaking_changes": ["List of any breaking changes that require user action"],
  "security_updates": ["List of any security-related fixes or improvements"],
  "upgrade_priority": "critical|high|medium|low - based on importance and urgency",
  "risk_assessment": "Assessment of risks associated with upgrading vs not upgrading",
  "technical_summary": "Detailed technical summary for developers and node operators",
  "executive_summary": "High-level summary for decision makers and executives", 
  "estimated_impact": "Who is affected and how (node operators, developers, end users, etc.)",
  "confidence_score": 0.85,
  "is_hard_fork": false,
  "hard_fork_details": null,
  "activation_block": null,
  "activation_date": null,
  "coordination_required": false
}

HARD FORK DETECTION GUIDELINES:
Pay special attention to identifying hard forks, which are critical network upgrades that require coordination:

1. **Hard Fork Indicators**: Look for these keywords and concepts:
   - "hard fork", "hardfork", "network upgrade"
   - "consensus change", "protocol change"
   - "activation block", "upgrade block"
   - "backward incompatible", "backwards incompatible"
   - Network names like "Shanghai", "Dencun", "Shapella", "Berlin", "London", etc.
   - "EIP" (Ethereum Improvement Proposal) implementations
   - "consensus layer", "execution layer" changes

2. **Hard Fork Information to Extract**:
   - Set "is_hard_fork": true if this is a hard fork
   - "hard_fork_details": Describe what the hard fork includes and changes
   - "activation_block": Extract specific block number if mentioned (as integer)
   - "activation_date": Extract specific date/time if mentioned (ISO format if possible)
   - "coordination_required": true if network participants must upgrade

3. **Date/Time Extraction**: Look for:
   - Specific dates: "January 15, 2024", "2024-01-15", "15 Jan 2024"
   - Block numbers with estimated times: "block 19000000 (approximately Jan 15)"
   - Relative times: "in 2 weeks", "next month"
   - Convert to ISO format when possible: "2024-01-15T00:00:00Z"

GENERAL GUIDELINES:
- Focus on practical implications for node operators, developers, and network participants
- Identify hard forks, consensus changes, and protocol upgrades clearly
- Highlight security issues with appropriate urgency
- Be concise but comprehensive
- Use clear, non-technical language for executive summary
- Rate confidence based on clarity and completeness of release notes
- If release notes are unclear or minimal, note this in your analysis
- For hard forks, always set upgrade_priority to "critical" or "high"

Provide ONLY the JSON response, no additional text."""

        return context
    
    async def analyze_release_notes(self, protocol_name: str, client_name: str,
                                  release_title: str, release_notes: str,
                                  tag_name: str, is_prerelease: bool = False,
                                  previous_analysis: Optional[str] = None,
                                  timeout_seconds: int = 60) -> Optional[AIAnalysisResult]:
        """Analyze release notes using AI and return structured results"""
        
        if not self.api_key:
            logger.warning("AI analysis skipped: No API key configured")
            return None
            
        if not release_notes or len(release_notes.strip()) < 10:
            logger.info("AI analysis skipped: Release notes too short or empty")
            return None
        
        try:
            prompt = self._build_analysis_prompt(
                protocol_name, client_name, release_title, 
                release_notes, tag_name, is_prerelease, previous_analysis
            )
            
            # Call the appropriate AI provider
            if self.provider == AIProvider.OPENAI:
                response = await self._call_openai(prompt, timeout_seconds)
            elif self.provider == AIProvider.ANTHROPIC:
                response = await self._call_anthropic(prompt, timeout_seconds)
            else:
                response = await self._call_local_llm(prompt, timeout_seconds)
            
            if not response:
                logger.error("AI analysis failed: No response from provider")
                return None
            
            # Parse JSON response
            try:
                analysis_data = json.loads(response)
                return AIAnalysisResult(**analysis_data)
            except json.JSONDecodeError as e:
                logger.error(f"AI analysis failed: Invalid JSON response: {e}")
                # Try to extract JSON from response if it's wrapped in other text
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    try:
                        analysis_data = json.loads(json_match.group())
                        return AIAnalysisResult(**analysis_data)
                    except json.JSONDecodeError:
                        pass
                
                logger.error(f"Could not parse AI response: {response[:200]}...")
                return None
                
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            return None
    
    async def _call_openai(self, prompt: str, timeout_seconds: int = 60) -> Optional[str]:
        """Call OpenAI API"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }
        
        # Handle model-specific parameters
        is_new_model = self.model and ('gpt-5' in self.model.lower() or 'o1' in self.model.lower())
        
        if is_new_model:
            # GPT-5 and o1 models have different parameter requirements:
            # - Use max_completion_tokens instead of max_tokens
            # - Temperature is fixed at 1.0 (cannot be customized)
            # - Other parameters like top_p may also be restricted
            payload["max_completion_tokens"] = 2000
            # No temperature parameter - uses default of 1.0
        else:
            # Older models (GPT-4, GPT-3.5-turbo, etc.) support legacy parameters
            payload["max_tokens"] = 2000
            payload["temperature"] = 0.1
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_seconds)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        error_text = await response.text()
                        logger.error(f"OpenAI API error {response.status}: {error_text}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error("OpenAI API timeout")
            return None
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return None
    
    async def _call_anthropic(self, prompt: str, timeout_seconds: int = 60) -> Optional[str]:
        """Call Anthropic Claude API"""
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }
        
        payload = {
            "model": self.model,
            "max_tokens": 2000,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/messages",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_seconds)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["content"][0]["text"]
                    else:
                        error_text = await response.text()
                        logger.error(f"Anthropic API error {response.status}: {error_text}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error("Anthropic API timeout")
            return None
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return None
    
    async def _call_local_llm(self, prompt: str, timeout_seconds: int = 120) -> Optional[str]:
        """Call local LLM (Ollama)"""
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "stream": False,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_seconds)  # Configurable timeout
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        error_text = await response.text()
                        logger.error(f"Local LLM error {response.status}: {error_text}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error("Local LLM timeout")
            return None
        except Exception as e:
            logger.error(f"Local LLM error: {e}")
            return None

    def detect_hard_fork(self, text: str, tag_name: str) -> Dict[str, Any]:
        """Detect hard fork information using pattern matching"""
        text_lower = text.lower()
        tag_lower = tag_name.lower()
        
        # Hard fork indicators
        hard_fork_patterns = [
            r"\bhard\s*fork\b",
            r"\bhardfork\b", 
            r"\bnetwork\s+upgrade\b",
            r"\bconsensus\s+change\b",
            r"\bprotocol\s+change\b",
            r"\bbackwards?\s+incompatible\b",
            r"\bactivation\s+block\b",
            r"\bupgrade\s+block\b"
        ]
        
        # Ethereum-specific patterns
        ethereum_patterns = [
            r"\b(shanghai|dencun|shapella|berlin|london|istanbul|constantinople|byzantium)\b",
            r"\beip[-\s]?\d+\b",
            r"\bconsensus\s+layer\b",
            r"\bexecution\s+layer\b"
        ]
        
        is_hard_fork = False
        hard_fork_details = []
        
        # Check for hard fork patterns
        for pattern in hard_fork_patterns + ethereum_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                is_hard_fork = True
                hard_fork_details.extend(matches)
        
        # Extract activation block
        activation_block = None
        block_patterns = [
            r"block\s+#?(\d+)",
            r"activation\s+block\s+#?(\d+)",
            r"upgrade\s+block\s+#?(\d+)"
        ]
        
        for pattern in block_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    activation_block = int(match.group(1))
                    break
                except ValueError:
                    continue
        
        # Extract activation date
        activation_date = None
        date_patterns = [
            r"(\d{4}-\d{2}-\d{2})",  # YYYY-MM-DD
            r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}",
            r"\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}"
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text_lower)
            if match:
                activation_date = match.group()
                break
        
        # Determine if coordination is required
        coordination_required = is_hard_fork or any(phrase in text_lower for phrase in [
            "all nodes must upgrade",
            "mandatory upgrade", 
            "coordination required",
            "network participants must",
            "validators must upgrade"
        ])
        
        return {
            "is_hard_fork": is_hard_fork,
            "hard_fork_details": "; ".join(hard_fork_details) if hard_fork_details else None,
            "activation_block": activation_block,
            "activation_date": activation_date,
            "coordination_required": coordination_required
        }

    def extract_key_phrases(self, text: str) -> List[str]:
        """Extract key phrases that might indicate important changes"""
        key_patterns = [
            r"breaking change",
            r"hard fork",
            r"consensus change",
            r"security fix",
            r"vulnerability",
            r"backward incompatible",
            r"migration required",
            r"deprecated",
            r"removed",
            r"critical",
            r"urgent"
        ]
        
        found_phrases = []
        text_lower = text.lower()
        
        for pattern in key_patterns:
            if re.search(pattern, text_lower):
                found_phrases.append(pattern.replace("\\b", ""))
        
        return found_phrases
    
    def estimate_importance(self, release_notes: str, tag_name: str, 
                          is_prerelease: bool = False) -> str:
        """Estimate importance based on simple heuristics as fallback"""
        text_lower = release_notes.lower()
        
        # Check for hard fork first
        hard_fork_info = self.detect_hard_fork(release_notes, tag_name)
        if hard_fork_info["is_hard_fork"]:
            return "critical"
        
        critical_keywords = ["security", "vulnerability", "critical", "urgent"]
        high_keywords = ["breaking", "consensus", "migration", "upgrade required", "backwards incompatible"]
        
        if any(keyword in text_lower for keyword in critical_keywords):
            return "critical"
        elif any(keyword in text_lower for keyword in high_keywords):
            return "high"
        elif is_prerelease:
            return "low"
        elif "patch" in tag_name.lower() or "hotfix" in tag_name.lower():
            return "medium"
        else:
            return "medium"