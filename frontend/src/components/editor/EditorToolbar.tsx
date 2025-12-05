import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Code,
    Heading1,
    Heading2,
    List,
    ListOrdered,
    Quote,
    Terminal,
    RemoveFormatting,
    Sparkles,
    Loader2,
    ClipboardPaste,
    Wand2,
    Check,
    Maximize2,
    ChevronDown,
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
    editor: Editor | null;
    frameless?: boolean;
}

export const EditorToolbar = ({ editor, frameless = false }: EditorToolbarProps) => {
    const { getToken } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isGenerating, setIsGenerating] = useState(false);

    if (!editor) {
        return null;
    }

    /**
     * Paste clipboard content as a code block (safe for XSS payloads)
     */
    const handlePasteAsCode = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                toast({
                    title: 'Clipboard empty',
                    description: 'No text found in clipboard to paste',
                    variant: 'destructive',
                });
                return;
            }

            // Insert as code block - Tiptap auto-escapes content
            editor.chain()
                .focus()
                .setCodeBlock()
                .insertContent(text)
                .run();

            toast({
                title: '📋 Pasted as code block',
                description: 'Content safely inserted (XSS-safe)',
            });
        } catch (error) {
            console.error('Failed to paste as code:', error);
            toast({
                title: 'Paste failed',
                description: 'Could not read clipboard. Try Ctrl+Shift+V instead.',
                variant: 'destructive',
            });
        }
    };

    const handleAiAction = async (type: 'rewrite' | 'fix_grammar' | 'expand') => {
        // Get selected text
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);

        // Check if text is selected
        if (!selectedText.trim()) {
            toast({
                title: 'No text selected',
                description: 'Please select text to improve with AI',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsGenerating(true);
            const token = await getToken();

            if (!token) {
                toast({
                    title: 'Authentication required',
                    description: 'Please sign in to use AI features',
                    variant: 'destructive',
                });
                return;
            }

            // Call AI API
            const response = await api.post(
                '/v1/ai/generate',
                {
                    type,
                    text: selectedText,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            // Replace selected text with AI-generated result
            editor
                .chain()
                .focus()
                .deleteSelection()
                .insertContent(response.data.result)
                .run();

            toast({
                title: '✨ Text improved!',
                description: `Used ${response.data.credits_used} credit(s). ${response.data.remaining_credits} remaining.`,
            });
        } catch (error: any) {
            console.error('AI generation error:', error);

            // Handle insufficient credits (402)
            if (error.response?.status === 402) {
                toast({
                    title: 'Running low on sparks! ⚡',
                    description: 'You need more credits to use AI features. Top up now?',
                    variant: 'destructive',
                });
                // Redirect to billing settings
                navigate('/settings?tab=billing');
            } else {
                toast({
                    title: 'AI generation failed',
                    description: error.response?.data?.detail || 'Failed to generate AI text. Please try again.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const ToolbarButton = ({
        onClick,
        isActive = false,
        children,
        title,
        disabled = false,
        className,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
        disabled?: boolean;
        className?: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            className={cn(
                'p-1.5 rounded-md transition-colors hover:bg-slate-100',
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className={cn(
            "flex items-center gap-0.5 p-2 sticky top-0 z-20",
            frameless 
                ? "bg-transparent border-b border-transparent pb-3" 
                : "border-b border-slate-100 bg-slate-50/50 rounded-t-lg"
        )}>
            {/* Formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold"
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic"
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Inline Code"
            >
                <Code className="h-4 w-4" />
            </ToolbarButton>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-200 mx-1" />

            {/* Structure */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-200 mx-1" />

            {/* Premium Blocks */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Callout / Note"
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title="Terminal / Code Block"
            >
                <Terminal className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={handlePasteAsCode}
                title="Paste as Code (Safe for payloads)"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
                <ClipboardPaste className="h-4 w-4" />
            </ToolbarButton>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-200 mx-1" />

            {/* AI Generate Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={isGenerating}
                        className={cn(
                            'p-1.5 rounded-md transition-colors flex items-center gap-1',
                            'text-emerald-600 hover:bg-emerald-50',
                            isGenerating && 'opacity-50 cursor-not-allowed'
                        )}
                        title="AI Magic Wand"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => handleAiAction('rewrite')}>
                        <Wand2 className="mr-2 h-4 w-4 text-purple-500" />
                        <span>Rewrite Professionally</span>
                        <span className="ml-auto text-xs text-slate-400">1⚡</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAiAction('fix_grammar')}>
                        <Check className="mr-2 h-4 w-4 text-green-500" />
                        <span>Fix Grammar</span>
                        <span className="ml-auto text-xs text-slate-400">1⚡</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAiAction('expand')}>
                        <Maximize2 className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Expand Note</span>
                        <span className="ml-auto text-xs text-slate-400">1⚡</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-200 mx-1" />

            {/* Clear Formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                title="Clear Formatting"
            >
                <RemoveFormatting className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
};
