import PageHead from '../components/PageHead'
import PipelineVisualizer from '../components/PipelineVisualizer'
import KnowledgeMap from '../components/KnowledgeMap'

export default function PipelinePage() {
  return (
    <main className="mc" id="main">
      <PageHead eyebrow="Behind the scenes" title="How your AI coach thinks">
        StudyBuddy isn't one model answering questions — it's a graph of specialist agents (assessment, curriculum, priority, planner, learning, evaluation, replanner) that hand off to each other. Watch them run, and see how your topics connect.
      </PageHead>
      <PipelineVisualizer />
      <KnowledgeMap />
    </main>
  )
}
