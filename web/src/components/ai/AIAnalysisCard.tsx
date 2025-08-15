/**
 * AI Analysis Card component for displaying AI-generated analysis of protocol updates
 */

import React, { useState } from 'react';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Collapse,
  Alert,
  Rating,
  Textarea,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Divider,
  List,
  ThemeIcon,
  Modal,
  MultiSelect,
} from '@mantine/core';
import {
  IconRobot,
  IconChevronDown,
  IconChevronUp,
  IconAlertTriangle,
  IconShieldCheck,
  IconTrendingUp,
  IconBrain,
  IconThumbUp,
  IconThumbDown,
  IconGitBranch,
  IconClock,
  IconCalendar,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';

interface AIAnalysis {
  summary?: string;
  key_changes?: string[];
  breaking_changes?: string[];
  security_updates?: string[];
  upgrade_priority?: 'critical' | 'high' | 'medium' | 'low';
  risk_assessment?: string;
  technical_summary?: string;
  executive_summary?: string;
  estimated_impact?: string;
  confidence_score?: number;
  is_hard_fork?: boolean;
  hard_fork_details?: string;
  activation_block?: number;
  activation_date?: string;
  coordination_required?: boolean;
  analysis_date?: string;
  provider?: string;
}

interface AIAnalysisCardProps {
  protocolUpdateId: number;
  analysis?: AIAnalysis | null;
  isLoading?: boolean;
  onAnalyze?: () => void;
  onFeedback?: (feedback: any) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'red';
    case 'high': return 'orange';
    case 'medium': return 'yellow';
    case 'low': return 'green';
    default: return 'gray';
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'critical': return IconAlertTriangle;
    case 'high': return IconTrendingUp;
    case 'medium': return IconShieldCheck;
    case 'low': return IconShieldCheck;
    default: return IconBrain;
  }
};

const formatRelativeTime = (date: string) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return diffMins <= 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
};

export function AIAnalysisCard({ 
  protocolUpdateId, 
  analysis, 
  isLoading = false, 
  onAnalyze, 
  onFeedback 
}: AIAnalysisCardProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [helpfulAspects, setHelpfulAspects] = useState<string[]>([]);
  const [improvementSuggestions, setImprovementSuggestions] = useState<string[]>([]);

  const handleSubmitFeedback = () => {
    if (onFeedback) {
      onFeedback({
        protocol_update_id: protocolUpdateId,
        rating: feedbackRating,
        feedback_text: feedbackText,
        helpful_aspects: helpfulAspects,
        improvement_suggestions: improvementSuggestions,
      });
    }
    setFeedbackModal(false);
    setFeedbackRating(0);
    setFeedbackText('');
    setHelpfulAspects([]);
    setImprovementSuggestions([]);
  };

  const helpfulOptions = [
    'Summary was accurate',
    'Key changes were well identified',
    'Breaking changes clearly highlighted',
    'Security issues properly flagged',
    'Risk assessment was helpful',
    'Hard fork detection was accurate',
    'Priority level was appropriate',
  ];

  const improvementOptions = [
    'Summary could be more detailed',
    'Missing important changes',
    'Incorrect priority assessment',
    'Hard fork detection needs improvement',
    'Risk assessment could be clearer',
    'Technical details need work',
    'Executive summary needs improvement',
  ];

  if (!analysis && !isLoading) {
    return (
      <Card withBorder>
        <Group justify="space-between">
          <Group gap="sm">
            <ThemeIcon variant="light" color="blue" size="lg">
              <IconRobot size={20} />
            </ThemeIcon>
            <div>
              <Text fw={500}>AI Analysis</Text>
              <Text size="sm" c="dimmed">No AI analysis available</Text>
            </div>
          </Group>
          {onAnalyze && (
            <Button variant="light" size="sm" onClick={onAnalyze}>
              Analyze with AI
            </Button>
          )}
        </Group>
      </Card>
    );
  }

  return (
    <>
      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconRobot size={20} />
              </ThemeIcon>
              <div>
                <Group gap="xs">
                  <Text fw={500}>AI Analysis</Text>
                  {analysis?.provider && (
                    <Badge variant="light" size="xs">
                      {analysis.provider}
                    </Badge>
                  )}
                  {analysis?.confidence_score && (
                    <Badge variant="light" color="teal" size="xs">
                      {Math.round(analysis.confidence_score * 100)}% confident
                    </Badge>
                  )}
                </Group>
                {analysis?.analysis_date && (
                  <Text size="xs" c="dimmed">
                    Analyzed {formatRelativeTime(analysis.analysis_date)}
                  </Text>
                )}
              </div>
            </Group>
            
            <Group gap="xs">
              {analysis?.upgrade_priority && (
                <Badge color={getPriorityColor(analysis.upgrade_priority)} variant="filled">
                  {analysis.upgrade_priority.toUpperCase()} PRIORITY
                </Badge>
              )}
              {analysis?.is_hard_fork && (
                <Badge color="red" variant="filled" leftSection={<IconGitBranch size={12} />}>
                  HARD FORK
                </Badge>
              )}
              <ActionIcon
                variant="subtle"
                onClick={() => setExpanded(!expanded)}
                size="sm"
              >
                {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </ActionIcon>
            </Group>
          </Group>

          {/* Summary */}
          {analysis?.summary && (
            <Alert icon={<IconBrain size={16} />} color="blue" variant="light">
              <Text size="sm">{analysis.summary}</Text>
            </Alert>
          )}

          {/* Hard Fork Alert */}
          {analysis?.is_hard_fork && (
            <Alert icon={<IconGitBranch size={16} />} color="red" variant="light">
              <Stack gap="xs">
                <Text fw={500} size="sm">Hard Fork Detected</Text>
                {analysis.hard_fork_details && (
                  <Text size="sm">{analysis.hard_fork_details}</Text>
                )}
                {analysis.activation_date && (
                  <Group gap="xs">
                    <IconCalendar size={14} />
                    <Text size="xs">
                      Activation: {new Date(analysis.activation_date).toLocaleDateString()}
                    </Text>
                  </Group>
                )}
                {analysis.activation_block && (
                  <Group gap="xs">
                    <IconClock size={14} />
                    <Text size="xs">Block: {analysis.activation_block.toLocaleString()}</Text>
                  </Group>
                )}
              </Stack>
            </Alert>
          )}

          {/* Quick insights */}
          <Group grow>
            {analysis?.breaking_changes && analysis.breaking_changes.length > 0 && (
              <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light" size="sm">
                <Text size="xs" fw={500}>{analysis.breaking_changes.length} Breaking Changes</Text>
              </Alert>
            )}
            {analysis?.security_updates && analysis.security_updates.length > 0 && (
              <Alert icon={<IconShieldCheck size={16} />} color="green" variant="light" size="sm">
                <Text size="xs" fw={500}>{analysis.security_updates.length} Security Updates</Text>
              </Alert>
            )}
          </Group>

          {/* Expandable details */}
          <Collapse in={expanded}>
            <Stack gap="md">
              <Divider />
              
              {/* Key Changes */}
              {analysis?.key_changes && analysis.key_changes.length > 0 && (
                <div>
                  <Text fw={500} size="sm" mb="xs">Key Changes</Text>
                  <List spacing="xs" size="sm">
                    {analysis.key_changes.map((change, index) => (
                      <List.Item key={index}>{change}</List.Item>
                    ))}
                  </List>
                </div>
              )}

              {/* Breaking Changes */}
              {analysis?.breaking_changes && analysis.breaking_changes.length > 0 && (
                <div>
                  <Text fw={500} size="sm" mb="xs" c="orange">Breaking Changes</Text>
                  <List spacing="xs" size="sm">
                    {analysis.breaking_changes.map((change, index) => (
                      <List.Item key={index} icon={<IconAlertTriangle size={14} color="orange" />}>
                        {change}
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}

              {/* Security Updates */}
              {analysis?.security_updates && analysis.security_updates.length > 0 && (
                <div>
                  <Text fw={500} size="sm" mb="xs" c="green">Security Updates</Text>
                  <List spacing="xs" size="sm">
                    {analysis.security_updates.map((update, index) => (
                      <List.Item key={index} icon={<IconShieldCheck size={14} color="green" />}>
                        {update}
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}

              {/* Risk Assessment */}
              {analysis?.risk_assessment && (
                <div>
                  <Text fw={500} size="sm" mb="xs">Risk Assessment</Text>
                  <Text size="sm" c="dimmed">{analysis.risk_assessment}</Text>
                </div>
              )}

              {/* Impact */}
              {analysis?.estimated_impact && (
                <div>
                  <Text fw={500} size="sm" mb="xs">Estimated Impact</Text>
                  <Text size="sm" c="dimmed">{analysis.estimated_impact}</Text>
                </div>
              )}

              {/* Technical vs Executive Summary Toggle */}
              {(analysis?.technical_summary || analysis?.executive_summary) && (
                <div>
                  <Text fw={500} size="sm" mb="xs">Detailed Analysis</Text>
                  {analysis.executive_summary && (
                    <div>
                      <Text size="xs" fw={500} mb="xs" c="blue">Executive Summary</Text>
                      <Text size="sm" c="dimmed" mb="md">{analysis.executive_summary}</Text>
                    </div>
                  )}
                  {analysis.technical_summary && (
                    <div>
                      <Text size="xs" fw={500} mb="xs" c="teal">Technical Summary</Text>
                      <Text size="sm" c="dimmed">{analysis.technical_summary}</Text>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback section */}
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Was this analysis helpful?</Text>
                <Group gap="xs">
                  <Tooltip label="This analysis was helpful">
                    <ActionIcon variant="light" color="green" size="sm">
                      <IconThumbUp size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="This analysis needs improvement">
                    <ActionIcon 
                      variant="light" 
                      color="red" 
                      size="sm"
                      onClick={() => setFeedbackModal(true)}
                    >
                      <IconThumbDown size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Button 
                    variant="subtle" 
                    size="xs"
                    onClick={() => setFeedbackModal(true)}
                  >
                    Leave Feedback
                  </Button>
                  {onAnalyze && (
                    <Button variant="subtle" size="xs" onClick={onAnalyze}>
                      Re-analyze
                    </Button>
                  )}
                </Group>
              </Group>
            </Stack>
          </Collapse>
        </Stack>
      </Card>

      {/* Feedback Modal */}
      <Modal
        opened={feedbackModal}
        onClose={() => setFeedbackModal(false)}
        title="Provide AI Analysis Feedback"
        size="md"
      >
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500} mb="xs">Overall Rating</Text>
            <Rating value={feedbackRating} onChange={setFeedbackRating} />
          </div>

          <MultiSelect
            label="What was helpful about this analysis?"
            placeholder="Select aspects that were helpful"
            data={helpfulOptions}
            value={helpfulAspects}
            onChange={setHelpfulAspects}
          />

          <MultiSelect
            label="What could be improved?"
            placeholder="Select areas for improvement"
            data={improvementOptions}
            value={improvementSuggestions}
            onChange={setImprovementSuggestions}
          />

          <Textarea
            label="Additional Comments"
            placeholder="Any other feedback about this AI analysis..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={3}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setFeedbackModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitFeedback}
              disabled={feedbackRating === 0}
            >
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}