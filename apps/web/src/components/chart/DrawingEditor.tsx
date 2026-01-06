'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash, Type } from 'lucide-react';
import { useChartStore } from '@/stores/useChartStore';

export const DrawingEditor: React.FC = () => {
	const [values, setValues] = useState<Record<string, any>>({});
	const [showTextInput, setShowTextInput] = useState(false);
	const [textInput, setTextInput] = useState('');
	const editorRef = useRef<HTMLDivElement>(null);
	const colorPickerActive = useRef(false);

	const { deleteDrawing, drawings } = useChartStore();
	const { selected } = drawings

	const handleDelete = async () => {
		if (!selected) return;
		selected.delete();
		deleteDrawing(selected);
	}

	useEffect(() => {
		if (selected) {
			const initialValues: Record<string, any> = {};
			selected.getEditableOptions().forEach(option => {
				initialValues[option.key] = option.currentValue;
			});
			setValues(initialValues);

			const textOption = selected.getEditableOptions().find(o => o.key === 'labelText');
			if (textOption) {
				setTextInput(textOption.currentValue?.toString() || '');
			}
		}
	}, [selected]);

	if (!selected) return null;

	const updateOption = (key: string, value: any) => {
		const newValues = { ...values, [key]: value };
		setValues(newValues);
		selected.updateOptions({ [key]: value });
	};

	const colorOptions = selected.getEditableOptions().filter(o => o.type === 'color');
	const numberOptions = selected.getEditableOptions().filter(o => o.type === 'number');

	const lineColorOption = colorOptions.find(o => o.key === 'color');
	const labelTextColorOption = colorOptions.find(o => o.key === 'labelTextColor');
	const labelBackgroundColorOption = colorOptions.find(o => o.key === 'labelBackgroundColor');

	const applyTextChanges = () => {
		if (colorPickerActive.current) {
			return;
		}

		updateOption('labelText', textInput);
		updateOption('showLabel', textInput.trim() !== '');
		setShowTextInput(false);
	};

	return (
		<div ref={editorRef} className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
			<div className="p-2 flex items-center space-x-2">
				{lineColorOption && (
					<Input
						type="color"
						value={values[lineColorOption.key] || '#000000'}
						onChange={(e) => updateOption(lineColorOption.key, e.target.value)}
						className="w-8 h-8 p-0 rounded-full cursor-pointer"
						title="Line Color"
					/>
				)}

				<Button
					size="sm"
					variant={showTextInput ? "default" : "ghost"}
					className="h-8 px-2"
					onClick={() => setShowTextInput(!showTextInput)}
					title="Edit Label Text"
				>
					<Type size={16} className="mr-1" />
					{textInput && !showTextInput ?
						<span className="text-xs max-w-20 truncate">{textInput}</span> :
						null
					}
				</Button>

				{numberOptions.map(option => (
					<div key={option.key} className="flex items-center space-x-1">
						<Button
							size="sm"
							variant="ghost"
							className="w-8 h-8 p-0"
							onClick={() => {
								updateOption(option.key, Math.max(1, (values[option.key] || 1) - 1));
							}}
							title="Decrease Width"
						>
							-
						</Button>
						<span className="text-xs">{values[option.key] || 1}</span>
						<Button
							size="sm"
							variant="ghost"
							className="w-8 h-8 p-0"
							onClick={() => {
								updateOption(option.key, (values[option.key] || 1) + 1);
							}}
							title="Increase Width"
						>
							+
						</Button>
					</div>
				))}

				<div className="flex-1"></div>

				<Button
					size="sm"
					variant="ghost"
					className="text-red-500 hover:text-red-700 w-8 h-8 p-0"
					onClick={handleDelete}
					title="Delete Drawing"
				>
					<Trash size={16} />
				</Button>
			</div>

			{showTextInput && (
				<div className="p-2 pt-0 border-t border-gray-200 dark:border-gray-700">
					<div className="flex flex-col space-y-2 mt-2">
						<Input
							value={textInput}
							onChange={e => setTextInput(e.target.value)}
							className="text-sm h-8"
							placeholder="Enter label text..."
							onBlur={applyTextChanges}
							onKeyDown={e => e.key === 'Enter' && applyTextChanges()}
							autoFocus
						/>


						<div className="flex items-center space-x-2">

							{labelTextColorOption && (
								<div className="flex items-center">
									<span className="text-xs mr-1">Text:</span>
									<Input
										type="color"
										value={values[labelTextColorOption.key] || '#ffffff'}
										onChange={e => updateOption(labelTextColorOption.key, e.target.value)}
										className="w-6 h-6 p-0 cursor-pointer"
										title="Text Color"
										onMouseDown={() => { colorPickerActive.current = true; }}
										onMouseUp={() => {
											// Use timeout to ensure this happens after blur would be processed
											setTimeout(() => { colorPickerActive.current = false; }, 100);
										}}
									/>
								</div>
							)}


							{labelBackgroundColorOption && (
								<div className="flex items-center">
									<span className="text-xs mr-1">Background:</span>
									<Input
										type="color"
										value={values[labelBackgroundColorOption.key] || '#000000'}
										onChange={e => updateOption(labelBackgroundColorOption.key, e.target.value)}
										className="w-6 h-6 p-0 cursor-pointer"
										title="Background Color"
										onMouseDown={() => { colorPickerActive.current = true; }}
										onMouseUp={() => {
											setTimeout(() => { colorPickerActive.current = false; }, 100);
										}}
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
