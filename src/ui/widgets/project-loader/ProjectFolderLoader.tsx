import { Button, Space, Typography } from 'antd'
import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons'
import { useRef, type ChangeEvent, type InputHTMLAttributes } from 'react'

interface DirectoryInputProps extends InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string
  directory?: string
}

interface ProjectFolderLoaderProps {
  isLoading: boolean
  onLoadProject: (files: FileList | File[]) => void | Promise<void>
}

export function ProjectFolderLoader({ isLoading, onLoadProject }: ProjectFolderLoaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files

    if (selectedFiles) {
      await onLoadProject(selectedFiles)
    }

    event.target.value = ''
  }

  const inputProps: DirectoryInputProps = {
    type: 'file',
    multiple: true,
    onChange: handleChange,
    webkitdirectory: '',
    directory: '',
    style: { display: 'none' },
  }

  return (
    <Space direction="vertical" size={12} className="loader-card__content">
      <Space align="center">
        <FolderOpenOutlined className="hero-card__icon" />
        <Typography.Text className="loader-card__label">Импорт локальной папки</Typography.Text>
      </Space>
      <Typography.Paragraph className="loader-card__text">
        Выберите папку проекта: построим дерево, разберём внутренние import и отметим нарушения порядка слоёв.
      </Typography.Paragraph>
      <Button type="primary" icon={<UploadOutlined />} loading={isLoading} block onClick={() => inputRef.current?.click()}>
        Загрузить папку проекта
      </Button>
      <input ref={inputRef} {...inputProps} />
    </Space>
  )
}
