/**
 * File browser component for exploring snapshot contents using Mantine Tree
 */

import { useState, useCallback } from 'react';
import {
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Stack,
  Card,
  Loader,
  Alert,
  Badge,
  ScrollArea,
  TextInput,
  Button,
} from '@mantine/core';
import {
  IconFolder,
  IconFile,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconDownload,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import type { TreeNodeData } from '@mantine/core';
import { formatBytes } from '../../utils/formatters';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  children?: FileNode[];
  path: string;
}

interface FileBrowserProps {
  fileTree: Record<string, unknown> | FileNode[];
  loading?: boolean;
  onFileSelect?: (filePath: string) => void;
  onDownload?: (filePath: string) => void;
}

interface TreeItemProps {
  node: FileNode;
  onFileSelect?: (filePath: string) => void;
  onDownload?: (filePath: string) => void;
  searchQuery?: string;
}

function buildTreeData(data: Record<string, unknown> | FileNode[], parentPath = ''): FileNode[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Object.entries(data).map(([key, value]) => {
    const currentPath = parentPath ? `${parentPath}/${key}` : key;
    const isFolder = typeof value === 'object' && value !== null && !Array.isArray(value);
    
    if (isFolder) {
      return {
        name: key,
        type: 'folder',
        path: currentPath,
        children: buildTreeData(value as Record<string, unknown>, currentPath),
      };
    } else {
      return {
        name: key,
        type: 'file',
        path: currentPath,
        size: typeof value === 'number' ? value : undefined,
      };
    }
  });
}

function convertToMantineTree(nodes: FileNode[], searchQuery = ''): TreeNodeData[] {
  const filterNodes = (nodes: FileNode[]): FileNode[] => {
    if (!searchQuery) return nodes;
    
    return nodes.filter(node => {
      if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      if (node.children) {
        const filteredChildren = filterNodes(node.children);
        return filteredChildren.length > 0;
      }
      return false;
    }).map(node => ({
      ...node,
      children: node.children ? filterNodes(node.children) : undefined,
    }));
  };

  const filtered = filterNodes(nodes);

  const convertNode = (node: FileNode): TreeNodeData => {
    const hasChildren = node.children && node.children.length > 0;
    
    return {
      value: node.path,
      label: (
        <Group gap="xs" wrap="nowrap">
          {node.type === 'folder' ? (
            <IconFolder size={16} color="orange" />
          ) : (
            <IconFile size={16} color="blue" />
          )}
          <Text size="sm" truncate>
            {node.name}
          </Text>
          {node.size && (
            <Badge size="xs" variant="light" color="gray">
              {formatBytes(node.size)}
            </Badge>
          )}
        </Group>
      ),
      children: hasChildren ? node.children!.map(convertNode) : undefined,
    };
  };

  return filtered.map(convertNode);
}

function TreeItem({ node, onFileSelect, onDownload, searchQuery }: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  
  const handleClick = useCallback(() => {
    if (node.type === 'folder') {
      setExpanded(!expanded);
    } else if (onFileSelect) {
      onFileSelect(node.path);
    }
  }, [node.type, node.path, expanded, onFileSelect]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(node.path);
    }
  }, [node.path, onDownload]);

  const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());
  
  return (
    <div>
      <Group
        gap="xs"
        p="xs"
        onClick={handleClick}
        style={{ 
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: matchesSearch ? 'transparent' : '#f8f9fa',
        }}
      >
        {node.type === 'folder' && (
          <ActionIcon variant="transparent" size="sm">
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        )}
        
        {node.type === 'folder' ? (
          <IconFolder size={16} color="orange" />
        ) : (
          <IconFile size={16} color="blue" />
        )}
        
        <Text size="sm" flex={1} truncate>
          {node.name}
        </Text>
        
        {node.size && (
          <Badge size="xs" variant="light" color="gray">
            {formatBytes(node.size)}
          </Badge>
        )}
        
        {node.type === 'file' && onDownload && (
          <Tooltip label="Download file">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={handleDownload}
            >
              <IconDownload size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      
      {expanded && hasChildren && (
        <div style={{ marginLeft: '20px' }}>
          {node.children!.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              onFileSelect={onFileSelect}
              onDownload={onDownload}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileBrowser({ fileTree, loading, onFileSelect, onDownload }: FileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFile(filePath);
    onFileSelect?.(filePath);
  }, [onFileSelect]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  if (loading) {
    return (
      <Card withBorder>
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading file tree...</Text>
        </Group>
      </Card>
    );
  }

  if (!fileTree || (typeof fileTree === 'object' && Object.keys(fileTree).length === 0)) {
    return (
      <Card withBorder>
        <Stack align="center" gap="md" py="xl">
          <IconAlertTriangle size={48} color="gray" />
          <div style={{ textAlign: 'center' }}>
            <Text fw={500} size="lg">
              No Files Available
            </Text>
            <Text c="dimmed">
              This snapshot doesn't have a file tree structure.
            </Text>
          </div>
        </Stack>
      </Card>
    );
  }

  const nodes = buildTreeData(fileTree);
  const treeData = convertToMantineTree(nodes, searchQuery);

  return (
    <Card withBorder>
      <Stack gap="md">
        {/* Search Header */}
        <Group>
          <TextInput
            placeholder="Search files and folders..."
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon variant="subtle" onClick={handleClearSearch}>
                  <IconX size={16} />
                </ActionIcon>
              )
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            flex={1}
          />
          
          {selectedFile && (
            <Button
              variant="light"
              size="sm"
              leftSection={<IconDownload size={16} />}
              onClick={() => onDownload?.(selectedFile)}
            >
              Download Selected
            </Button>
          )}
        </Group>

        {/* File Tree */}
        <ScrollArea.Autosize mah={600} type="scroll">
          {treeData.length > 0 ? (
            <div>
              {nodes.map((node) => (
                <TreeItem
                  key={node.path}
                  node={node}
                  onFileSelect={handleFileSelect}
                  onDownload={onDownload}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          ) : searchQuery ? (
            <Alert color="yellow" icon={<IconSearch size={16} />}>
              No files found matching "{searchQuery}"
            </Alert>
          ) : (
            <Text c="dimmed" ta="center" py="md">
              No files to display
            </Text>
          )}
        </ScrollArea.Autosize>

        {/* Stats */}
        <Group justify="space-between" pt="sm" style={{ borderTop: '1px solid #e0e0e0' }}>
          <Text size="sm" c="dimmed">
            {nodes.filter(n => n.type === 'folder').length} folders, {nodes.filter(n => n.type === 'file').length} files
          </Text>
          
          {selectedFile && (
            <Text size="sm" c="dimmed">
              Selected: {selectedFile}
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}