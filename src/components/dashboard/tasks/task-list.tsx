'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getTodos, addTodo, toggleTodo, deleteTodo, clearCompletedTodos } from '@/app/actions/dashboard'
import { Play, Plus, Trash2, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

type Todo = {
    id: string
    task_name: string
    is_completed: boolean
    created_at: string
}

export function TaskList() {
    const [todos, setTodos] = useState<Todo[]>([])
    const [newTask, setNewTask] = useState('')
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        loadTodos()
    }, [])

    const handleClearCompleted = async () => {
        setTodos(prev => prev.filter(t => !t.is_completed))
        const res = await clearCompletedTodos()
        if (!res.success) {
            toast.error("Failed to clear tasks")
            loadTodos()
        } else {
            toast.success("Cleared completed tasks")
        }
    }

    const loadTodos = async () => {
        try {
            const data = await getTodos()
            setTodos(data || [])
        } catch (error) {
            toast.error("Failed to load tasks")
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTask.trim()) return
        
        setAdding(true)
        try {
            // Optimistic update
            const tempId = Math.random().toString()
            const optimisticTodo = { id: tempId, task_name: newTask, is_completed: false, created_at: new Date().toISOString() }
            setTodos([optimisticTodo, ...todos])
            setNewTask('')

            const res = await addTodo(optimisticTodo.task_name)
            if (res.success && res.data) {
                setTodos(prev => prev.map(t => t.id === tempId ? res.data : t))
            } else {
                // Revert
                setTodos(prev => prev.filter(t => t.id !== tempId))
                toast.error("Failed to add task")
            }
        } catch (error) {
            toast.error("Error adding task")
        } finally {
            setAdding(false)
        }
    }

    const handleToggle = async (id: string, currentStatus: boolean) => {
        // Optimistic
        setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t))
        
        try {
            const res = await toggleTodo(id, !currentStatus)
            if (!res.success) {
                // Revert
                setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: currentStatus } : t))
                toast.error("Failed to update task")
            }
        } catch (error) {
             setTodos(prev => prev.map(t => t.id === id ? { ...t, is_completed: currentStatus } : t))
        }
    }

    const handleDelete = async (id: string) => {
        const original = todos.find(t => t.id === id)
        setTodos(prev => prev.filter(t => t.id !== id))

        try {
            const res = await deleteTodo(id)
            if (!res.success) {
                if (original) setTodos(prev => [...prev, original])
                toast.error("Failed to delete task")
            }
        } catch (error) {
             if (original) setTodos(prev => [...prev, original])
        }
    }

    const handlePlay = (taskName: string) => {
        // Dispatch custom event for FocusController to pick up
        window.dispatchEvent(new CustomEvent('play-task', { detail: taskName }))
        toast.info(`Ready to focus: ${taskName}`)
    }

    if (loading) return <div className="h-[300px] w-full animate-pulse bg-zinc-900 rounded-xl" />

    const activeTodos = todos.filter(t => !t.is_completed)
    const completedTodos = todos.filter(t => t.is_completed)

    return (
        <Card className="border-zinc-800 bg-zinc-950/50 h-full flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-zinc-400 text-sm font-medium uppercase tracking-wider">To Do</CardTitle>
                {todos.some(t => t.is_completed) && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearCompleted}
                        className="h-6 px-2 text-[10px] uppercase tracking-wider text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                    >
                        Clear Done
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 min-h-[300px] lg:max-h-[600px] overflow-hidden">
                <form onSubmit={handleAdd} className="flex gap-2">
                    <Input 
                        placeholder="Add a new task..." 
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 text-zinc-100"
                    />
                    <Button type="submit" size="icon" disabled={adding}>
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {activeTodos.length === 0 && completedTodos.length === 0 && (
                        <p className="text-center text-zinc-600 text-xs py-8">No tasks available.</p>
                    )}

                    {activeTodos.map(todo => (
                        <div key={todo.id} className="group flex items-center justify-between p-2 rounded-md hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <Checkbox 
                                    checked={todo.is_completed} 
                                    onCheckedChange={() => handleToggle(todo.id, todo.is_completed)}
                                    className="border-zinc-700 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                />
                                <span className="text-sm text-zinc-300 truncate">{todo.task_name}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-zinc-500 hover:text-green-400 hover:bg-green-400/10"
                                    onClick={() => handlePlay(todo.task_name)}
                                    title="Start Session"
                                >
                                    <Play className="h-3 w-3" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                                    onClick={() => handleDelete(todo.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {completedTodos.length > 0 && (
                        <div className="pt-4 border-t border-zinc-900 mt-2">
                            <p className="text-xs text-zinc-600 font-medium mb-2 uppercase">Completed</p>
                            {completedTodos.map(todo => (
                                <div key={todo.id} className="flex items-center justify-between p-2 rounded-md opacity-50 hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-3">
                                        <Checkbox 
                                            checked={todo.is_completed} 
                                            onCheckedChange={() => handleToggle(todo.id, todo.is_completed)}
                                        />
                                        <span className="text-sm text-zinc-500 line-through truncate">{todo.task_name}</span>
                                    </div>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-7 w-7 text-zinc-600 hover:text-red-400"
                                        onClick={() => handleDelete(todo.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
