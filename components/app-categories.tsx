"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ComponentProps } from "react";

import {
  countCategoryItemsAction,
  createCategoryAction,
  deleteCategoryAction,
  moveCategoriesAction,
  updateCategoryAction,
} from "@/app/(app)/category-actions";
import { CategoryHome } from "@/components/category-home";
import {
  CategoryOptionsButton,
  type CategoryApi,
  type ManagedCategory,
  type TilePreview,
} from "@/components/category-manager";
import { categoryHref, homeHref, REORDER_PARAM } from "@/lib/categories";
import type { ItemStatus } from "@/lib/types";

// Categorias no app de verdade: as server actions de category-actions.ts.
// Elas revalidam a página, então a tela já volta atualizada (sem refresh).
function useAppCategoryApi(then?: { status: ItemStatus }): CategoryApi {
  return useMemo(
    () => ({
      create: (input) => createCategoryAction(input),
      update: (id, input) => updateCategoryAction(id, input),
      move: (ids) => moveCategoriesAction(ids),
      count: (id) => countCategoryItemsAction(id),
      remove: (id) => deleteCategoryAction(id, then),
    }),
    [then],
  );
}

// Início (50/51) com "+ Nova categoria", menu 55 e modo de ordem.
export function AppCategoryHome({
  initialReorder = false,
  ...props
}: Omit<ComponentProps<typeof CategoryHome>, "manage" | "onOpen"> & {
  initialReorder?: boolean;
}) {
  const router = useRouter();
  const api = useAppCategoryApi();

  return (
    <CategoryHome
      {...props}
      manage={{
        api,
        initialReorder,
        onSeeItems: (category, status) => router.push(categoryHref(category.id, status)),
        // Tira o ?mudar-ordem=1 da URL (recarregar não volta ao modo de ordem).
        onReorderEnd: initialReorder
          ? () => router.replace(homeHref(props.status), { scroll: false })
          : undefined,
      }}
    />
  );
}

// "···" no cabeçalho da categoria (52/53).
export function AppCategoryOptions({
  category,
  categories,
  status,
  preview,
}: {
  category: ManagedCategory;
  categories: ManagedCategory[];
  status: ItemStatus;
  preview: TilePreview;
}) {
  const router = useRouter();
  const then = useMemo(() => ({ status }), [status]);
  const api = useAppCategoryApi(then);

  return (
    <CategoryOptionsButton
      category={category}
      categories={categories}
      preview={preview}
      api={api}
      onReorder={() => router.push(homeHref(status, REORDER_PARAM))}
      onSeeItems={(target, itemStatus) => router.push(categoryHref(target.id, itemStatus))}
    />
  );
}
