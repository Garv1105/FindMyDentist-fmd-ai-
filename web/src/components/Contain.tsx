"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps a failure inside: a 3D model that can't load (a dropped connection, a blocked request) shows `fallback`
 * (nothing by default) instead of taking the page down with it. A canvas's errors surface in the React tree around it.
 */
export default class Contain extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
