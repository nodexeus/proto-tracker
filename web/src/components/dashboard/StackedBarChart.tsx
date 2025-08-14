/**
 * Stacked bar chart component with client-specific colors and tooltips
 */

import { useState, useCallback } from 'react';
import { Group, Stack, Text, Tooltip, Box } from '@mantine/core';

interface ClientData {
  client_id: number;
  client_name: string;
  updates: number;
  hard_forks: number;
}

interface MonthData {
  month: string;
  updates: number;
  hard_forks: number;
  updates_by_client: ClientData[];
}

interface StackedBarChartProps {
  data: MonthData[];
  height?: number;
  maxItems?: number;
}

// Helper function to generate consistent colors for clients
function getClientColor(clientName: string): string {
  const colors = [
    '#228be6', '#40c057', '#fd7e14', '#e03131', '#862e9c', 
    '#0c8599', '#495057', '#c92a2a', '#5c7cfa', '#51cf66',
    '#ffd43b', '#ff6b6b', '#748ffc', '#69db7c', '#ffa8a8'
  ];
  
  const index = clientName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function StackedBarChart({ data, height = 200, maxItems = 6 }: StackedBarChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<{
    month: string;
    client: ClientData;
    x: number;
    y: number;
  } | null>(null);

  // Get the maximum updates count to normalize bar heights
  const maxUpdates = Math.max(...data.map(d => d.updates), 1);
  
  // Show only the most recent months
  const displayData = data.slice(-maxItems);

  const handleSegmentHover = useCallback((
    month: string, 
    client: ClientData, 
    event: React.MouseEvent
  ) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setHoveredSegment({
      month,
      client,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleSegmentLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);

  return (
    <Box style={{ position: 'relative' }}>
      <Stack gap="xs">
        {displayData.map((item) => (
          <Group key={item.month} justify="space-between" align="center">
            <Text size="sm" w={80} style={{ flexShrink: 0 }}>
              {item.month}
            </Text>
            
            <Box 
              style={{ 
                flex: 1, 
                height: 16, 
                display: 'flex',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              {/* Stacked bar segments */}
              {item.updates_by_client.length > 0 ? (
                item.updates_by_client.map((client, index) => {
                  const widthPercent = (client.updates / item.updates) * 100;
                  const color = getClientColor(client.client_name);
                  
                  
                  return (
                    <Box
                      key={`${item.month}-${client.client_id}-${index}`}
                      style={{
                        width: `${widthPercent}%`,
                        height: '100%',
                        backgroundColor: color,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                        opacity: hoveredSegment && 
                                 (hoveredSegment.month !== item.month || 
                                  hoveredSegment.client.client_id !== client.client_id) ? 0.3 : 1,
                        borderRight: index < item.updates_by_client.length - 1 ? '1px solid rgba(255,255,255,0.5)' : undefined,
                        minWidth: '2px' // Ensure very small segments are still visible
                      }}
                      onMouseEnter={(e) => handleSegmentHover(item.month, client, e)}
                      onMouseLeave={handleSegmentLeave}
                    />
                  );
                })
              ) : null}
            </Box>
            
            <Text size="xs" c="dimmed" w={30} ta="right" style={{ flexShrink: 0 }}>
              {item.updates}
            </Text>
          </Group>
        ))}
        
        <Text size="xs" c="dimmed" ta="center" mt="xs">
          Showing last {maxItems} months
        </Text>
      </Stack>

      {/* Custom tooltip */}
      {hoveredSegment && (
        <Box
          style={{
            position: 'fixed',
            left: hoveredSegment.x,
            top: hoveredSegment.y - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <Stack gap={4}>
            <Text size="sm" fw={600} c="white">
              {hoveredSegment.client.client_name}
            </Text>
            <Text size="xs" c="white" style={{ opacity: 0.9 }}>
              {hoveredSegment.month}
            </Text>
            <Group gap="sm">
              <Text size="xs" c="white">
                Updates: {hoveredSegment.client.updates}
              </Text>
              {hoveredSegment.client.hard_forks > 0 && (
                <Text size="xs" c="#ff6b6b">
                  Hard Forks: {hoveredSegment.client.hard_forks}
                </Text>
              )}
            </Group>
          </Stack>
        </Box>
      )}
    </Box>
  );
}