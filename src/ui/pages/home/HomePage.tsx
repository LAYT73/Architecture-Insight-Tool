import { Layout, Space, Tag, Typography } from 'antd'
import { ProjectExplorer } from '../../widgets/project-explorer/ProjectExplorer'

const { Header, Content } = Layout
const { Title, Text } = Typography

export function HomePage() {
  const statusTags = [
    { label: 'Тёмная тема', color: 'magenta' },
    { label: 'Адаптивная вёрстка', color: 'red' },
    { label: 'Ant Design', color: 'volcano' },
  ]

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div>
          <Text className="app-header__eyebrow">Architecture Insight Tool</Text>
          <Title level={2} className="app-header__title">
            Структура проекта: дерево и graph зависимостей
          </Title>
        </div>

        <Space wrap>
          {statusTags.map((tag) => (
            <Tag key={tag.label} color={tag.color} className="app-header__tag">
              {tag.label}
            </Tag>
          ))}
        </Space>
      </Header>

      <Content className="app-content">
        <Space direction="vertical" size={16} className="main-stack">
          <ProjectExplorer />
        </Space>
      </Content>
    </Layout>
  )
}
