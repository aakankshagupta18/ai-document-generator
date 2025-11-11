import type { Task, TaskStatus, WorkflowStatus, WorkflowStatistics } from '@/types/task';

export interface DemoTimelineStep {
  delay: number; // milliseconds delay from previous step
  workflow: WorkflowStatus;
}

const baseWorkflow = {
  workflowId: 'workflow_demo_vision',
  jobId: 'job_demo_vision',
  createdAt: new Date('2025-11-05T13:05:28Z').toISOString(),
};

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    children: task.children ? cloneTasks(task.children) : undefined,
  }));
}

function computeStatistics(tasks: Task[]): WorkflowStatistics {
  let total = 0;
  let completed = 0;
  let failed = 0;
  let running = 0;
  let pending = 0;
  let totalScore = 0;
  let scoredCount = 0;

  const traverse = (list: Task[]) => {
    list.forEach((task) => {
      total += 1;
      switch (task.status) {
        case 'completed':
          completed += 1;
          if (typeof task.score === 'number') {
            totalScore += task.score;
            scoredCount += 1;
          }
          break;
        case 'failed':
          failed += 1;
          break;
        case 'running':
          running += 1;
          break;
        default:
          pending += 1;
      }
      if (task.children?.length) {
        traverse(task.children);
      }
    });
  };

  traverse(tasks);

  return {
    total,
    completed,
    failed,
    running,
    pending,
    averageScore: scoredCount > 0 ? totalScore / scoredCount : 0,
    estimatedTimeRemaining: running > 0 || pending > 0 ? 120 : 0,
  };
}

function createWorkflowSnapshot(
  tasks: Task[],
  status: TaskStatus,
  updatedAt: string,
): WorkflowStatus {
  const clonedTasks = cloneTasks(tasks);
  const statistics = computeStatistics(clonedTasks);
  const overallProgress =
    statistics.total > 0 ? Math.round((statistics.completed / statistics.total) * 100) : 0;

  return {
    ...baseWorkflow,
    status,
    overallProgress,
    tasks: clonedTasks,
    statistics,
    updatedAt,
  };
}

const initialTasks: Task[] = [
  {
    id: 'task_world_vision_topic',
    name: 'WorldVisionTopicDeterminationTask',
    type: 'topic_determination',
    status: 'running',
    startTime: '2025-11-05T13:06:05Z',
    children: [],
    metadata: {
      keys: [
        'primary_trend',
        'trend_data',
        'urgency_growth',
        'scale_expansion',
        'future_worsening',
        'world_vision_topic',
        'key_messages',
        'human_need',
        'global_scale_evidence',
        'vision_rationale',
      ],
    },
  },
  {
    id: 'task_create_world_vision_section',
    name: 'CreateWorldVisionSectionTask',
    type: 'section_creation',
    status: 'pending',
    children: [
      {
        id: 'task_topic_sentence',
        name: 'TopicSentenceTask',
        type: 'sentence_generation',
        status: 'pending',
        children: [],
      },
      {
        id: 'task_supporting_sentence_1',
        name: 'SupportingSentenceTask #1',
        type: 'sentence_generation',
        status: 'pending',
        children: [],
      },
      {
        id: 'task_supporting_sentence_2',
        name: 'SupportingSentenceTask #2',
        type: 'sentence_generation',
        status: 'pending',
        children: [],
      },
      {
        id: 'task_concluding_sentence',
        name: 'ConcludingSentenceTask',
        type: 'sentence_generation',
        status: 'pending',
        children: [],
      },
      {
        id: 'task_combine_sentences',
        name: 'CombineSentencesTask',
        type: 'combine',
        status: 'pending',
        children: [],
      },
      {
        id: 'task_create_paragraph',
        name: 'CreateParagraphTask',
        type: 'paragraph_generation',
        status: 'pending',
        children: [],
      },
    ],
  },
  {
    id: 'task_create_title',
    name: 'CreateTitleTask',
    type: 'title_generation',
    status: 'pending',
    children: [],
  },
];

const snapshot1 = createWorkflowSnapshot(initialTasks, 'running', '2025-11-05T13:06:05Z');

const snapshot2Tasks = cloneTasks(initialTasks);
snapshot2Tasks[0] = {
  ...snapshot2Tasks[0],
  status: 'completed',
  score: 0.9,
  endTime: '2025-11-05T13:06:05Z',
  output: 'Empowering Lives Through Sustainable Data Solutions',
  metadata: {
    ...snapshot2Tasks[0].metadata,
    key_messages: [
      'By 2030, the demand for data storage will threaten the digital services that billions rely on, as data center energy consumption is projected to double.',
      'The exponential growth of data generation is accelerating the urgency of sustainable data storage solutions for vulnerable communities.',
      'The convergence of rising energy demands and unprecedented data growth is creating critical challenges in data access and sustainability.',
    ],
  },
};
snapshot2Tasks[1].status = 'running';
(snapshot2Tasks[1].children ??= [])[0].status = 'running';

const snapshot2 = createWorkflowSnapshot(snapshot2Tasks, 'running', '2025-11-05T13:06:27Z');

const snapshot3Tasks = cloneTasks(snapshot2Tasks);
const worldVisionSection = snapshot3Tasks[1];
if (worldVisionSection.children) {
  worldVisionSection.children[0] = {
    ...worldVisionSection.children[0],
    status: 'completed',
    score: 0.8,
    output:
      'The urgent need for sustainable data storage solutions is critical as global data demands threaten essential services and equitable access to information.',
    endTime: '2025-11-05T13:06:56Z',
  };
  worldVisionSection.children[1] = {
    ...worldVisionSection.children[1],
    status: 'running',
  };
}

const snapshot3 = createWorkflowSnapshot(snapshot3Tasks, 'running', '2025-11-05T13:06:56Z');

const snapshot4Tasks = cloneTasks(snapshot3Tasks);
if (snapshot4Tasks[1].children) {
  snapshot4Tasks[1].children[1] = {
    ...snapshot4Tasks[1].children![1],
    status: 'completed',
    score: 0.7,
    output:
      'As the reliance on cloud services expands, the strain on energy resources not only threatens operational sustainability but also limits equitable access for underserved populations.',
    endTime: '2025-11-05T13:07:43Z',
  };
  snapshot4Tasks[1].children[2] = {
    ...snapshot4Tasks[1].children![2],
    status: 'completed',
    score: 0.85,
    output:
      'This escalating demand not only threatens the integrity of essential services but also highlights the need for solutions that safeguard vulnerable communities relying on consistent digital access.',
    endTime: '2025-11-05T13:08:08Z',
  };
  snapshot4Tasks[1].children[3] = {
    ...snapshot4Tasks[1].children![3],
    status: 'running',
  };
}

const snapshot4 = createWorkflowSnapshot(snapshot4Tasks, 'running', '2025-11-05T13:08:08Z');

const snapshot5Tasks = cloneTasks(snapshot4Tasks);
if (snapshot5Tasks[1].children) {
  snapshot5Tasks[1].children[3] = {
    ...snapshot5Tasks[1].children![3],
    status: 'completed',
    score: 0.8,
    output:
      'Addressing these challenges through sustainable data solutions is essential for fostering equitable access to critical digital infrastructure worldwide.',
    endTime: '2025-11-05T13:09:04Z',
  };
  snapshot5Tasks[1].children[4] = {
    ...snapshot5Tasks[1].children![4],
    status: 'completed',
    output:
      'The urgent need for sustainable data storage solutions is critical as global data demands threaten essential services and equitable access to information.',
    endTime: '2025-11-05T13:09:49Z',
  };
  snapshot5Tasks[1].children[5] = {
    ...snapshot5Tasks[1].children![5],
    status: 'running',
  };
}
snapshot5Tasks[2] = {
  ...snapshot5Tasks[2],
  status: 'running',
};

const snapshot5 = createWorkflowSnapshot(snapshot5Tasks, 'running', '2025-11-05T13:09:49Z');

const snapshot6Tasks = cloneTasks(snapshot5Tasks);
if (snapshot6Tasks[1].children) {
  snapshot6Tasks[1].children[5] = {
    ...snapshot6Tasks[1].children![5],
    status: 'completed',
    score: 0.8,
    output:
      'The urgent need for sustainable data storage solutions is critical as global data demands threaten essential services and equitable access to information. As the reliance on cloud services expands, the strain on energy resources not only threatens operational sustainability but also limits equitable access for underserved populations. This escalating demand not only threatens the integrity of essential services but also highlights the need for solutions that safeguard vulnerable communities relying on consistent digital access. Addressing these challenges through sustainable data solutions is essential for fostering equitable access to critical digital infrastructure worldwide.',
    endTime: '2025-11-05T13:10:13Z',
  };
  snapshot6Tasks[1] = {
    ...snapshot6Tasks[1],
    status: 'completed',
    endTime: '2025-11-05T13:10:13Z',
  };
}
snapshot6Tasks[2] = {
  ...snapshot6Tasks[2],
  status: 'completed',
  score: 0.85,
  output: 'Harnessing Sustainable Data Solutions to Transform Lives Globally',
  endTime: '2025-11-05T13:06:27Z',
};

const snapshot6 = createWorkflowSnapshot(snapshot6Tasks, 'running', '2025-11-05T13:10:13Z');

const snapshot7Tasks = cloneTasks(snapshot6Tasks);
snapshot7Tasks.push({
  id: 'task_energy_challenges_paragraph',
  name: 'CreateParagraphTask #2',
  type: 'paragraph_generation',
  status: 'completed',
  score: 0.8,
  startTime: '2025-11-05T13:10:41Z',
  endTime: '2025-11-05T13:13:13Z',
  output:
    'The escalating energy demands of cloud services pose significant challenges to operational sustainability and equitable access. This surge in energy consumption disproportionately impacts low-income communities, limiting their ability to access critical digital infrastructure and services. As energy costs rise, tech companies face mounting pressure to innovate sustainable solutions that can reduce operational burdens while maintaining accessibility. Addressing these energy challenges through innovative solutions is imperative to ensure equitable access to digital services worldwide.',
  children: [],
});

const snapshot7 = createWorkflowSnapshot(snapshot7Tasks, 'running', '2025-11-05T13:13:13Z');

const snapshot8Tasks = cloneTasks(snapshot7Tasks);
snapshot8Tasks.push({
  id: 'task_energy_efficiency_paragraph',
  name: 'CreateParagraphTask #3',
  type: 'paragraph_generation',
  status: 'completed',
  score: 0.8,
  startTime: '2025-11-05T13:13:59Z',
  endTime: '2025-11-05T13:17:24Z',
  output:
    'The rapid escalation in data storage demands underscores the critical need for pioneering energy-efficient technologies. As cloud computing becomes integral to various sectors, the reliance on outdated storage solutions exacerbates energy consumption and amplifies the environmental footprint. The impending doubling of energy consumption in data centers necessitates a paradigm shift towards sustainable infrastructure. Investing in next-generation storage solutions can significantly reduce energy consumption, ensuring that the benefits of digital transformation are distributed equitably across society.',
  children: [],
});

const snapshot8 = createWorkflowSnapshot(snapshot8Tasks, 'completed', '2025-11-05T13:17:24Z');

export const demoWorkflowTimeline: DemoTimelineStep[] = [
  { delay: 0, workflow: snapshot1 },
  { delay: 2000, workflow: snapshot2 },
  { delay: 2000, workflow: snapshot3 },
  { delay: 2000, workflow: snapshot4 },
  { delay: 2000, workflow: snapshot5 },
  { delay: 2000, workflow: snapshot6 },
  { delay: 2500, workflow: snapshot7 },
  { delay: 2500, workflow: snapshot8 },
];


