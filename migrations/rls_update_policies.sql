-- Enable creators to update their own nodes (needed for soft delete)
CREATE POLICY "Creators can update their own nodes" 
ON public.nodes 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Enable creators to update their own paragraphs (needed for soft delete)
CREATE POLICY "Creators can update their own paragraphs" 
ON public.paragraphs 
FOR UPDATE 
USING (auth.uid() = created_by);
