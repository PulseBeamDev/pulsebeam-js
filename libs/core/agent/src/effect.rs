use alloc::vec::Vec;

pub(crate) struct Effects<E> {
    inner: Vec<E>,
}

impl<E> Effects<E> {
    pub(crate) const fn new() -> Self {
        Self { inner: Vec::new() }
    }

    pub(crate) fn emit(&mut self, effect: E) {
        self.inner.push(effect);
    }

    pub(crate) fn extend(&mut self, effects: impl IntoIterator<Item = E>) {
        self.inner.extend(effects);
    }
}

impl<E> IntoIterator for Effects<E> {
    type Item = E;
    type IntoIter = alloc::vec::IntoIter<E>;

    fn into_iter(self) -> Self::IntoIter {
        self.inner.into_iter()
    }
}
