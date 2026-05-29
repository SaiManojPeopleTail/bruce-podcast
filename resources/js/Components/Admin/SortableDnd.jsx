import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    defaultDropAnimationSideEffects,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

export function useSortableSensors() {
    return useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
}

/**
 * @param {{
 *   items: Array,
 *   getId: (item: unknown) => string,
 *   onReorder: (items: Array) => void,
 *   className?: string,
 *   children: React.ReactNode,
 *   renderOverlay?: (item: unknown) => React.ReactNode,
 * }} props
 */
export function SortableDndProvider({
    items,
    getId,
    onReorder,
    className = '',
    children,
    renderOverlay,
}) {
    const sensors = useSortableSensors();
    const [activeId, setActiveId] = useState(null);

    const ids = items.map(getId);
    const activeItem = activeId ? items.find((item) => getId(item) === activeId) : null;

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const oldIndex = items.findIndex((item) => getId(item) === active.id);
        const newIndex = items.findIndex((item) => getId(item) === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        onReorder(arrayMove(items, oldIndex, newIndex));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
                <div className={className}>{children}</div>
            </SortableContext>

            <DragOverlay
                dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: { active: { opacity: '0.4' } },
                    }),
                }}
            >
                {activeItem && renderOverlay ? (
                    <div className="cursor-grabbing">{renderOverlay(activeItem)}</div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

/**
 * @param {{
 *   id: string,
 *   className?: string,
 *   style?: React.CSSProperties,
 *   children: React.ReactNode,
 * }} props
 */
export function SortableDndItem({ id, className = '', style: styleProp, children }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        ...styleProp,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 0 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={className}
            {...attributes}
            {...listeners}
        >
            {children}
        </div>
    );
}
