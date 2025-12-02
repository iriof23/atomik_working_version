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
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
    editor: Editor | null;
}

export const EditorToolbar = ({ editor }: EditorToolbarProps) => {
    const { getToken } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [isGenerating, setIsGenerating] = useState(false);

    if (!editor) {
        return null;
    }

    const handleAiGenerate = async () => {
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
                    type: 'fix_grammar',
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
                'p-2 rounded-md transition-colors hover:bg-zinc-800',
                isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            title={title}
        >
            {children}
        </button>
    );

    return (
        <div className="flex items-center gap-1 p-2 border-b border-zinc-800/50 bg-transparent sticky top-0 z-20 backdrop-blur-sm">
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
            <div className="w-px h-6 bg-zinc-800 mx-1" />

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
            <div className="w-px h-6 bg-zinc-800 mx-1" />

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

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-800 mx-1" />

            {/* AI Generate Button */}
            <ToolbarButton
                onClick={handleAiGenerate}
                disabled={isGenerating}
                title="Improve with AI (1 credit)"
                className="text-purple-400 hover:text-purple-300"
            >
                {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="h-4 w-4" />
                )}
            </ToolbarButton>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-800 mx-1" />

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
