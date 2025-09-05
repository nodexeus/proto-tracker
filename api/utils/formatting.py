"""
Utility functions for formatting data in human-readable formats.
"""

def format_bytes(bytes_value):
    """
    Convert bytes to human-readable format (MB, GB, TB, PB).
    
    Args:
        bytes_value (int): Size in bytes
        
    Returns:
        str: Human-readable size string
    """
    if bytes_value < 1000:
        return f"{bytes_value} B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    size = float(bytes_value)
    unit_index = 0
    
    while size >= 1000 and unit_index < len(units) - 1:
        size /= 1000
        unit_index += 1
    
    # Format with appropriate decimal places
    if size >= 100:
        return f"{size:.0f} {units[unit_index]}"
    elif size >= 10:
        return f"{size:.1f} {units[unit_index]}"
    else:
        return f"{size:.2f} {units[unit_index]}"


def format_number_with_commas(number):
    """
    Format a number with comma separators for readability.
    
    Args:
        number (int): Number to format
        
    Returns:
        str: Number formatted with commas
    """
    return f"{number:,}"
