import { useState, useRef } from 'react'
import { Upload, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface Screenshot {
    id: string
    url: string
    caption: string
}

interface ScreenshotUploaderProps {
    screenshots: Screenshot[]
    onUpdate: (screenshots: Screenshot[]) => void
}

export default function ScreenshotUploader({ screenshots, onUpdate }: ScreenshotUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [screenshotToDelete, setScreenshotToDelete] = useState<string | null>(null)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0])
        }
    }

    const processFile = (file: File) => {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File size too large. Max 5MB.')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const result = e.target?.result as string
            const newScreenshot: Screenshot = {
                id: `screen-${Date.now()}`,
                url: result,
                caption: ''
            }
            onUpdate([...screenshots, newScreenshot])
        }
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const updateCaption = (id: string, caption: string) => {
        const updated = screenshots.map(s => s.id === id ? { ...s, caption } : s)
        onUpdate(updated)
    }

    const removeScreenshot = (id: string) => {
        setScreenshotToDelete(id);
        setShowDeleteDialog(true);
    };

    const confirmRemoveScreenshot = () => {
        if (screenshotToDelete) {
            onUpdate(screenshots.filter(s => s.id !== screenshotToDelete));
        }
        setShowDeleteDialog(false);
        setScreenshotToDelete(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Screenshots & Evidence
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Upload Screenshot
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={handleFileSelect}
                />
            </div>

            {/* Upload Area */}
            {screenshots.length === 0 && (
                <div
                    className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                        isDragging
                            ? "border-primary bg-primary/5"
                            : "border-gray-300 dark:border-gray-700 hover:border-primary/50"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                            <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            PNG, JPG, GIF up to 5MB
                        </p>
                    </div>
                </div>
            )}

            {/* Screenshots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screenshots.map((screenshot) => (
                    <Card key={screenshot.id} className="overflow-hidden group">
                        <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                            <img
                                src={screenshot.url}
                                alt="Evidence"
                                className="w-full h-full object-contain"
                            />
                            <button
                                onClick={() => removeScreenshot(screenshot.id)}
                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <CardContent className="p-3">
                            <Input
                                value={screenshot.caption}
                                onChange={(e) => updateCaption(screenshot.id, e.target.value)}
                                placeholder="Add a caption..."
                                className="text-xs"
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Delete Screenshot Confirmation */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-white border-slate-200 shadow-2xl sm:rounded-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <AlertDialogTitle className="text-lg font-semibold text-slate-900">
                                Remove Screenshot?
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed pl-13">
                            This will permanently remove this screenshot from the evidence. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel 
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveScreenshot}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Remove Screenshot
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
