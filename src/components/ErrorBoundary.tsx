"use client"

import { AlertCircleIcon } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route content failed to render", error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>
          {this.props.fallbackTitle ?? "Something went wrong"}
        </AlertTitle>
        <AlertDescription>
          <p>{this.state.error.message}</p>
          <Button variant="outline" size="sm" onClick={this.reset}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
}
