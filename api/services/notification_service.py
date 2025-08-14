"""
Notification service for sending webhook notifications
"""

import logging
import json
from typing import Dict, Any, List, Optional
import aiohttp
from datetime import datetime

logger = logging.getLogger(__name__)

class NotificationService:
    """Service for sending notifications via webhooks"""
    
    @staticmethod
    async def send_discord_webhook(webhook_url: str, message: str, embeds: List[Dict[str, Any]] = None) -> bool:
        """Send a Discord webhook notification"""
        try:
            payload = {
                "content": message,
                "username": "Protocol Tracker",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/8297/8297741.png"
            }
            
            if embeds:
                payload["embeds"] = embeds
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    if response.status == 204:
                        logger.info("Discord webhook sent successfully")
                        return True
                    else:
                        logger.error(f"Discord webhook failed with status {response.status}: {await response.text()}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending Discord webhook: {e}")
            return False
    
    @staticmethod
    async def send_slack_webhook(webhook_url: str, message: str, attachments: List[Dict[str, Any]] = None) -> bool:
        """Send a Slack webhook notification"""
        try:
            payload = {
                "text": message,
                "username": "Protocol Tracker",
                "icon_emoji": ":bell:"
            }
            
            if attachments:
                payload["attachments"] = attachments
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as response:
                    if response.status == 200:
                        logger.info("Slack webhook sent successfully")
                        return True
                    else:
                        logger.error(f"Slack webhook failed with status {response.status}: {await response.text()}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending Slack webhook: {e}")
            return False
    
    @staticmethod
    async def send_telegram_message(bot_token: str, chat_id: str, message: str, parse_mode: str = "Markdown") -> bool:
        """Send a Telegram message"""
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": parse_mode,
                "disable_web_page_preview": False
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        logger.info("Telegram message sent successfully")
                        return True
                    else:
                        logger.error(f"Telegram message failed with status {response.status}: {await response.text()}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False
    
    @staticmethod
    async def send_generic_webhook(webhook_url: str, payload: Dict[str, Any], headers: Dict[str, str] = None) -> bool:
        """Send a generic JSON webhook"""
        try:
            request_headers = {"Content-Type": "application/json"}
            if headers:
                request_headers.update(headers)
            
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload, headers=request_headers) as response:
                    if 200 <= response.status < 300:
                        logger.info(f"Generic webhook sent successfully (status: {response.status})")
                        return True
                    else:
                        logger.error(f"Generic webhook failed with status {response.status}: {await response.text()}")
                        return False
                        
        except Exception as e:
            logger.error(f"Error sending generic webhook: {e}")
            return False
    
    @staticmethod
    def format_protocol_update_discord_embed(client_name: str, tag: str, title: str, url: str, notes: str = None, is_prerelease: bool = False) -> Dict[str, Any]:
        """Format a protocol update as a Discord embed"""
        color = 0xffa500 if is_prerelease else 0x00ff00  # Orange for prerelease, green for release
        
        embed = {
            "title": f"🚀 New {client_name} Release: {tag}",
            "description": title or f"New release {tag} is now available",
            "color": color,
            "url": url,
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {
                "text": "Protocol Tracker",
                "icon_url": "https://cdn-icons-png.flaticon.com/512/8297/8297741.png"
            },
            "fields": [
                {
                    "name": "Client",
                    "value": client_name,
                    "inline": True
                },
                {
                    "name": "Version",
                    "value": tag,
                    "inline": True
                },
                {
                    "name": "Type",
                    "value": "Pre-release" if is_prerelease else "Release",
                    "inline": True
                }
            ]
        }
        
        if notes and len(notes.strip()) > 0:
            # Truncate notes if too long (Discord has limits)
            truncated_notes = notes[:500] + "..." if len(notes) > 500 else notes
            embed["fields"].append({
                "name": "Release Notes",
                "value": truncated_notes,
                "inline": False
            })
        
        return embed
    
    @staticmethod
    def format_protocol_update_slack_attachment(client_name: str, tag: str, title: str, url: str, notes: str = None, is_prerelease: bool = False) -> Dict[str, Any]:
        """Format a protocol update as a Slack attachment"""
        color = "warning" if is_prerelease else "good"  # Yellow for prerelease, green for release
        
        attachment = {
            "fallback": f"New {client_name} release: {tag}",
            "color": color,
            "title": f"🚀 New {client_name} Release: {tag}",
            "title_link": url,
            "text": title or f"New release {tag} is now available",
            "fields": [
                {
                    "title": "Client",
                    "value": client_name,
                    "short": True
                },
                {
                    "title": "Version",
                    "value": tag,
                    "short": True
                },
                {
                    "title": "Type",
                    "value": "Pre-release" if is_prerelease else "Release",
                    "short": True
                }
            ],
            "footer": "Protocol Tracker",
            "ts": int(datetime.utcnow().timestamp())
        }
        
        if notes and len(notes.strip()) > 0:
            # Truncate notes if too long
            truncated_notes = notes[:300] + "..." if len(notes) > 300 else notes
            attachment["fields"].append({
                "title": "Release Notes",
                "value": truncated_notes,
                "short": False
            })
        
        return attachment
    
    @staticmethod
    def format_protocol_update_telegram(client_name: str, tag: str, title: str, url: str, notes: str = None, is_prerelease: bool = False) -> str:
        """Format a protocol update as a Telegram message"""
        release_type = "🔥 Pre-release" if is_prerelease else "🚀 Release"
        
        message = f"*{release_type}*: [{client_name} {tag}]({url})\n\n"
        
        if title:
            message += f"*{title}*\n\n"
        
        message += f"📦 *Client:* {client_name}\n"
        message += f"🏷️ *Version:* `{tag}`\n"
        message += f"📝 *Type:* {'Pre-release' if is_prerelease else 'Release'}\n"
        
        if notes and len(notes.strip()) > 0:
            # Truncate notes if too long (Telegram has 4096 char limit)
            truncated_notes = notes[:800] + "..." if len(notes) > 800 else notes
            # Escape markdown special characters in notes
            escaped_notes = truncated_notes.replace('*', '\\*').replace('_', '\\_').replace('[', '\\[').replace(']', '\\]').replace('`', '\\`')
            message += f"\n📋 *Release Notes:*\n{escaped_notes}\n"
        
        message += f"\n🔗 [View Release]({url})"
        
        return message
    
    @staticmethod
    def format_protocol_update_generic(client_name: str, tag: str, title: str, url: str, notes: str = None, is_prerelease: bool = False) -> Dict[str, Any]:
        """Format a protocol update as a generic JSON payload"""
        return {
            "event": "protocol_update",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "client": client_name,
                "tag": tag,
                "title": title,
                "url": url,
                "notes": notes,
                "is_prerelease": is_prerelease,
                "type": "prerelease" if is_prerelease else "release"
            }
        }
    
    async def send_protocol_update_notifications(
        self, 
        client_name: str, 
        tag: str, 
        title: str, 
        url: str, 
        notes: str = None, 
        is_prerelease: bool = False,
        # Support for multiple URLs (new)
        discord_webhook_urls: List[str] = None,
        slack_webhook_urls: List[str] = None,
        telegram_bot_token: str = None,
        telegram_chat_ids: List[str] = None,
        generic_webhook_configs: List[Dict[str, Any]] = None,
        # Backward compatibility (legacy single URL support)
        discord_webhook_url: str = None,
        slack_webhook_url: str = None,
        generic_webhook_url: str = None,
        generic_headers: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Send protocol update notifications to all configured webhooks"""
        results = {
            'discord': [],
            'slack': [],
            'telegram': [],
            'generic': []
        }
        
        # Prepare Discord embed once
        discord_embed = self.format_protocol_update_discord_embed(
            client_name, tag, title, url, notes, is_prerelease
        )
        
        # Send Discord notifications (multiple URLs)
        all_discord_urls = []
        if discord_webhook_urls:
            all_discord_urls.extend(discord_webhook_urls)
        if discord_webhook_url:  # Backward compatibility
            all_discord_urls.append(discord_webhook_url)
        
        for webhook_url in all_discord_urls:
            success = await self.send_discord_webhook(
                webhook_url,
                f"🚀 New {client_name} release: **{tag}**",
                [discord_embed]
            )
            results['discord'].append({'url': webhook_url, 'success': success})
        
        # Prepare Slack attachment once
        slack_attachment = self.format_protocol_update_slack_attachment(
            client_name, tag, title, url, notes, is_prerelease
        )
        
        # Send Slack notifications (multiple URLs)
        all_slack_urls = []
        if slack_webhook_urls:
            all_slack_urls.extend(slack_webhook_urls)
        if slack_webhook_url:  # Backward compatibility
            all_slack_urls.append(slack_webhook_url)
        
        for webhook_url in all_slack_urls:
            success = await self.send_slack_webhook(
                webhook_url,
                f"🚀 New {client_name} release: {tag}",
                [slack_attachment]
            )
            results['slack'].append({'url': webhook_url, 'success': success})
        
        # Send Telegram notifications (multiple chat IDs)
        if telegram_bot_token and telegram_chat_ids:
            telegram_message = self.format_protocol_update_telegram(
                client_name, tag, title, url, notes, is_prerelease
            )
            
            for chat_id in telegram_chat_ids:
                success = await self.send_telegram_message(
                    telegram_bot_token,
                    chat_id,
                    telegram_message
                )
                results['telegram'].append({'chat_id': chat_id, 'success': success})
        
        # Prepare generic payload once
        generic_payload = self.format_protocol_update_generic(
            client_name, tag, title, url, notes, is_prerelease
        )
        
        # Send generic webhook notifications (multiple URLs with custom headers)
        all_generic_configs = []
        if generic_webhook_configs:
            all_generic_configs.extend(generic_webhook_configs)
        if generic_webhook_url:  # Backward compatibility
            all_generic_configs.append({
                'url': generic_webhook_url,
                'headers': generic_headers or {}
            })
        
        for config in all_generic_configs:
            success = await self.send_generic_webhook(
                config['url'],
                generic_payload,
                config.get('headers')
            )
            results['generic'].append({'url': config['url'], 'success': success})
        
        return results
    
    async def test_webhook(self, webhook_type: str, webhook_url: str = None, bot_token: str = None, chat_id: str = None, headers: Dict[str, str] = None) -> bool:
        """Test a webhook configuration"""
        try:
            if webhook_type == 'discord':
                return await self.send_discord_webhook(
                    webhook_url,
                    "🔔 Test notification from Protocol Tracker",
                    [{
                        "title": "Webhook Test",
                        "description": "This is a test notification to verify your Discord webhook is working correctly.",
                        "color": 0x0066cc,
                        "timestamp": datetime.utcnow().isoformat(),
                        "footer": {
                            "text": "Protocol Tracker Test"
                        }
                    }]
                )
            
            elif webhook_type == 'slack':
                return await self.send_slack_webhook(
                    webhook_url,
                    "🔔 Test notification from Protocol Tracker",
                    [{
                        "fallback": "Webhook test",
                        "color": "good",
                        "title": "Webhook Test",
                        "text": "This is a test notification to verify your Slack webhook is working correctly.",
                        "footer": "Protocol Tracker Test"
                    }]
                )
            
            elif webhook_type == 'telegram':
                test_message = "*🔔 Test Notification*\n\nThis is a test message from Protocol Tracker to verify your Telegram bot is working correctly.\n\n✅ If you can see this message, your configuration is working!"
                return await self.send_telegram_message(
                    bot_token,
                    chat_id,
                    test_message
                )
            
            elif webhook_type == 'generic':
                return await self.send_generic_webhook(
                    webhook_url,
                    {
                        "event": "webhook_test",
                        "message": "This is a test notification from Protocol Tracker",
                        "timestamp": datetime.utcnow().isoformat(),
                        "source": "Protocol Tracker"
                    },
                    headers
                )
            
            else:
                logger.error(f"Unknown webhook type: {webhook_type}")
                return False
                
        except Exception as e:
            logger.error(f"Error testing {webhook_type} webhook: {e}")
            return False